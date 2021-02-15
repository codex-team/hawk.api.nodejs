import express from 'express';
import * as telegram from '../utils/telegram';
import {
  CheckCodes,
  CheckResponse,
  CheckRequest,
  FailCodes,
  FailResponse,
  PayCodes,
  PayRequest,
  PayResponse,
  RecurrentCodes,
  RecurrentResponse
} from './types';
import { BusinessOperationStatus, PayloadOfWorkspacePlanPurchase, BusinessOperationType } from 'hawk.types';
import WorkspaceModel from '../models/workspace';
import { TelegramBotURLs } from '../types/bgTasks';
import HawkCatcher from '@hawk.so/nodejs';
import { publish } from '../rabbitmq';

/**
 * Class for describing the logic of payment routes
 */
export default class CloudPaymentsWebhooks {
  /**
   * Returns router for payments
   *
   * @returns - express router for payments
   */
  public getRouter(): express.Router {
    const router = express.Router();

    router.all('/check', this.check);
    router.all('/pay', this.pay);
    router.all('/fail', this.fail);
    router.all('/recurrent', this.recurrent);

    return router;
  }

  /**
   * Route to confirm the correctness of a user's payment
   * https://developers.cloudpayments.ru/#check
   *
   * @param req - cloudpayments request with payment details
   * @param res - check result code
   */
  private async check(req: express.Request, res: express.Response): Promise<void> {
    const body: CheckRequest = req.body;
    const context = req.context;

    if (!body.Data) {
      res.send({
        code: CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED,
      });

      telegram.sendMessage(`❌[Billing / Check] There is no necessary data in the request`, TelegramBotURLs.Money);
      HawkCatcher.send(new Error('[Billing / Check] There is no necessary data in the request'), body);

      return;
    }

    const { workspaceId, userId, tariffPlanId } = body.Data;
    const workspace = await context.factories.workspacesFactory.findById(workspaceId);

    if (!workspace) {
      res.send({
        code: CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED,
      });

      telegram.sendMessage(`❌[Billing / Check] Workspace was not found &laquo;${workspaceId}&raquo;`, TelegramBotURLs.Money);
      HawkCatcher.send(new Error('[Billing / Check] Workspace was not found'), body);

      return;
    }

    const member = await workspace.getMemberInfo(userId);

    if (!member || WorkspaceModel.isPendingMember(member)) {
      res.send({
        code: CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED,
      });

      telegram.sendMessage(`❌[Billing / Check] The user cannot pay for &laquo;${workspace.name}&raquo; workspace because he is not a member of it`, TelegramBotURLs.Money);
      HawkCatcher.send(new Error('[Billing / Check] The user is not a member of the workspace'), body);

      return;
    }

    if (!member.isAdmin) {
      res.send({
        code: CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED,
      });

      telegram.sendMessage(`❌[Billing / Check] The user cannot pay for &laquo;${workspace.name}&raquo; workspace because he is not an admin`, TelegramBotURLs.Money);
      HawkCatcher.send(new Error('[Billing / Check] The user is not an admin'), body);

      return;
    }

    const plan = await context.factories.plansFactory.findById(tariffPlanId);

    if (!plan) {
      res.send({
        code: CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED,
      });

      telegram.sendMessage(`❌[Billing / Check] Plan was not found &laquo;${workspace.name}&raquo;`, TelegramBotURLs.Money);
      HawkCatcher.send(new Error('[Billing / Check] Plan was not found'), body);

      return;
    }

    if (body.Amount !== plan.monthlyCharge) {
      res.send({
        code: CheckCodes.WRONG_AMOUNT,
      });

      telegram.sendMessage(`❌[Billing / Check] Amount does not equal to plan monthly charge &laquo;${workspace.name}&raquo;`, TelegramBotURLs.Money);
      HawkCatcher.send(new Error('[Billing / Check] Amount does not equal to plan monthly charge'), body);

      return;
    }

    /**
     * Create business operation about creation of subscription
     */
    try {
      await context.factories.businessOperationsFactory.create<PayloadOfWorkspacePlanPurchase>({
        transactionId: body.TransactionId.toString(),
        type: BusinessOperationType.WorkspacePlanPurchase,
        status: BusinessOperationStatus.Pending,
        payload: {
          workspaceId: workspace._id,
          amount: body.Amount,
          userId: member._id,
          tariffPlanId: plan._id,
        },
        dtCreated: body.DateTime,
      });
    } catch (err) {
      res.send({
        code: CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED,
      });

      telegram.sendMessage(`❌[Billing / Check] Business operation wasn't created &laquo;${workspace.name}&raquo;`, TelegramBotURLs.Money);
      HawkCatcher.send(new Error('[Billing / Check] Business operation wasn\'t created'), {
        body,
        err,
      });

      return;
    }

    telegram.sendMessage(`✅ [Billing / Check] All checks passed successfully &laquo;${workspace.name}&raquo;`, TelegramBotURLs.Money);
    HawkCatcher.send(new Error('[Billing / Check] All checks passed successfully'), body);

    res.send({
      code: CheckCodes.SUCCESS,
    } as CheckResponse);
  }

  /**
   * Route for fixing a successful payment
   * https://developers.cloudpayments.ru/#pay
   *
   * @param req - cloudpayments request with payment details
   * @param res - result code
   */
  private async pay(req: express.Request, res: express.Response): Promise<void> {
    const body: PayRequest = req.body;
    const context = req.context;
    const data = body.Data;

    /**
     * @todo full data validation and error handling
     */

    if (!data || !data.workspaceId || !data.tariffPlanId) {
      res.json({
        code: PayCodes.SUCCESS,
      } as PayResponse);

      return;
    }

    const businessOperation = await context.factories.businessOperationsFactory.getBusinessOperationByTransactionId(body.TransactionId.toString());

    if (!businessOperation) {
      return;
    }

    await businessOperation.setStatus(BusinessOperationStatus.Confirmed);

    const workspace = await context.factories.workspacesFactory.findById(data.workspaceId);
    const tariffPlan = await context.factories.plansFactory.findById(data.tariffPlanId);

    if (workspace && tariffPlan) {
      await workspace.resetBillingPeriod();
      await workspace.changePlan(tariffPlan._id);
    }

    await publish('cron-tasks', 'cron-tasks/limiter', JSON.stringify({
      type: 'check-single-workspace',
      workspaceId: data.workspaceId,
    }));

    res.send({
      code: PayCodes.SUCCESS,
    } as PayResponse);
  }

  /**
   * Route for refused payments
   * https://developers.cloudpayments.ru/#fail
   *
   * @param req - cloudpayments request with payment details
   * @param res - result code
   */
  private async fail(req: express.Request, res: express.Response): Promise<void> {
    res.send({
      code: FailCodes.SUCCESS,
    } as FailResponse);
  }

  /**
   * Route is executed if the status of the recurring payment subscription has been changed.
   * https://developers.cloudpayments.ru/#recurrent
   *
   * @param req - cloudpayments request with subscription details
   * @param res - result code
   */
  private async recurrent(req: express.Request, res: express.Response): Promise<void> {
    res.send({
      code: RecurrentCodes.SUCCESS,
    } as RecurrentResponse);
  }
}
