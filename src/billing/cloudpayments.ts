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
import { BusinessOperationStatus, PayloadOfWorkspacePlanPurchase, BusinessOperationType, PendingMemberDBScheme, ConfirmedMemberDBScheme, PlanDBScheme } from 'hawk.types';
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

    router.get('/compose-payment', this.composePayment);
    router.all('/check', this.check.bind(this));
    router.all('/pay', this.pay);
    router.all('/fail', this.fail);
    router.all('/recurrent', this.recurrent);

    return router;
  }

  /**
   * Prepares payment data before charge
   *
   * @param req — Express request object
   * @param res - Express response object
   */
  private async composePayment(req: express.Request, res: express.Response): Promise<void> {
    const { workspaceId, tariffId } = req.query;

    /**
     * @todo fetch workspace data: name, tariff and so on. I need services to work with storages
     */
    const tariff = 'Basic';
    const invoiceId = `CDX 21-02-04 ${tariff}`;
    const plan = {
      id: '',
      name: '',
    };

    res.send({
      workspaceId: workspaceId,
      tariffId: tariffId,
      invoiceId: invoiceId,
      amount: 299,
      plan: plan,
      currency: 'USD',
      checksum: 'some hash',
    });
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
    const data = body.Data;
    const context = req.context;

    let workspace: WorkspaceModel;
    let user: ConfirmedMemberDBScheme;
    let plan: PlanDBScheme;

    if (!data || !data.workspaceId || !data.tariffPlanId || !data.userId) {
      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, '[Billing / Check] There is no necessary data in the request', body);

      return;
    }

    const { workspaceId, userId, tariffPlanId } = data;

    try {
      workspace = await this.getWorkspace(req, workspaceId);
      user = await this.getUser(userId, workspace);
      plan = await this.getPlan(req, tariffPlanId);
    } catch (err) {
      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, `[Billing / Check] ${err.toString()}`, body);

      return;
    }

    if (body.Amount !== plan.monthlyCharge) {
      this.sendError(res, CheckCodes.WRONG_AMOUNT, `[Billing / Check] Amount does not equal to plan monthly charge`, body);

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
          userId: user._id,
          tariffPlanId: plan._id,
        },
        dtCreated: body.DateTime,
      });
    } catch (err) {
      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, `[Billing / Check] Business operation wasn't created`, body);

      return;
    }

    telegram.sendMessage(`✅ [Billing / Check] All checks passed successfully &laquo;${workspace.name}&raquo;`, TelegramBotURLs.Money);
    HawkCatcher.send(new Error('[Billing / Check] All checks passed successfully'), body);

    res.json({
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

    res.json({
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
    res.json({
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
    res.json({
      code: RecurrentCodes.SUCCESS,
    } as RecurrentResponse);
  }

  /**
   * Get workspace by workspace id
   *
   * @param req - express request
   * @param workspaceId - id of workspace
   */
  private async getWorkspace(req: express.Request, workspaceId: string): Promise<WorkspaceModel> {
    const workspace = await req.context.factories.workspacesFactory.findById(workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    return workspace;
  }

  /**
   * Get user info
   *
   * @param userId - id of current user
   * @param workspace - workspace data
   */
  private async getUser(userId: string, workspace: WorkspaceModel): Promise<ConfirmedMemberDBScheme> {
    const user = await workspace.getMemberInfo(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user || WorkspaceModel.isPendingMember(user)) {
      throw new Error('User cannot pay for current workspace because he is not a member of it');
    }

    if (!user.isAdmin) {
      throw new Error('User cannot pay for current workspace because he is not an admin');
    }

    return user;
  }

  /**
   * Get workspace plan
   *
   * @param req - express request
   * @param tariffPlanId - plan id
   */
  private async getPlan(req: express.Request, tariffPlanId: string): Promise<PlanDBScheme> {
    const plan = await req.context.factories.plansFactory.findById(tariffPlanId);

    if (!plan) {
      throw new Error('Plan not found');
    }

    return plan;
  }

  /**
   * Send an error to telegram, Hawk and send an express response with the error code
   *
   * @param res - Express response
   * @param errorCode - code of error
   * @param errorText - error description
   * @param backtrace - request data and error data
   */
  private sendError(res: express.Response, errorCode: CheckCodes | PayCodes | FailCodes | RecurrentCodes, errorText: string, backtrace: { [key: string]: any }): void {
    res.json({
      code: errorCode,
    });

    telegram.sendMessage(`❌ ${errorText}`, TelegramBotURLs.Money);
    HawkCatcher.send(new Error(errorText), backtrace);
  }
}
