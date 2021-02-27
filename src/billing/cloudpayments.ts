import express from 'express';
import * as telegram from '../utils/telegram';
import { TelegramBotURLs } from '../utils/telegram';
import {
  CheckCodes,
  CheckRequest,
  CheckResponse,
  FailCodes,
  FailResponse,
  PayCodes,
  PayRequest,
  PayResponse,
  RecurrentCodes,
  RecurrentResponse
} from './types';
import {
  BusinessOperationStatus,
  BusinessOperationType,
  ConfirmedMemberDBScheme,
  PayloadOfWorkspacePlanPurchase,
  PlanDBScheme
} from 'hawk.types';
import { PENNY_MULTIPLIER, AccountType, Currency } from 'codex-accounting-sdk';
import WorkspaceModel from '../models/workspace';
import HawkCatcher from '@hawk.so/nodejs';
import { publish } from '../rabbitmq';

import sendNotification from '../utils/personalNotifications';
import { PlanProlongationNotificationTask, SenderWorkerTaskType } from '../types/personalNotifications';
import BusinessOperationModel from '../models/businessOperation';
import UserModel from '../models/user';
import checksumService from '../utils/checksumService';

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

    router.get('/compose-payment', this.composePayment.bind(this));
    router.all('/check', this.check.bind(this));
    router.all('/pay', this.pay.bind(this));
    router.all('/fail', this.fail.bind(this));
    router.all('/recurrent', this.recurrent.bind(this));

    return router;
  }

  /**
   * Prepares payment data before charge
   *
   * @param req — Express request object
   * @param res - Express response object
   */
  private async composePayment(req: express.Request, res: express.Response): Promise<void> {
    const { workspaceId, tariffPlanId } = req.query as Record<string, string>;
    const userId = req.context.user.id;

    if (!workspaceId || !tariffPlanId || !userId) {
      this.sendError(res, 1, `[Billing / Compose payment] No workspace, tariff plan or user id in request body`, req.query);

      return;
    }

    let workspace;
    let tariffPlan;

    try {
      workspace = await this.getWorkspace(req, workspaceId);
      tariffPlan = await this.getPlan(req, tariffPlanId);
    } catch (e) {
      this.sendError(res, 1, `[Billing / Compose payment] Can't get data from Database ${e.toString()}`, req.query);

      return;
    }

    try {
      await this.getMember(userId, workspace);
    } catch (e) {
      this.sendError(res, 1, `[Billing / Compose payment] Can't compose payment due to error: ${e.toString()}`, req.query);

      return;
    }
    const invoiceId = this.generateInvoiceId(tariffPlan);

    let checksum;

    try {
      checksum = await checksumService.generateChecksum({
        workspaceId: workspace._id.toString(),
        userId: userId,
        tariffPlanId: tariffPlan._id.toString(),
      });
    } catch (e) {
      this.sendError(res, 1, `[Billing / Compose payment] Can't generate checksum: ${e.toString()}`, req.query);

      return;
    }

    res.send({
      invoiceId,
      plan: {
        id: tariffPlan._id.toString(),
        name: tariffPlan.name,
        monthlyCharge: tariffPlan.monthlyCharge,
      },
      currency: 'USD',
      checksum,
    });
  }

  /**
   * Generates invoice id for payment
   *
   * @param tariffPlan - tariff plan to generate invoice id
   */
  private generateInvoiceId(tariffPlan: PlanDBScheme): string {
    const now = new Date();

    return `CDX ${now.getDate()}/${now.getMonth() + 1} ${tariffPlan.name}`;
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
    let data;

    try {
      data = checksumService.parseAndVerifyData(body.Data);
    } catch (e) {
      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, `[Billing / Pay] Can't parse data from body`, body);

      return;
    }

    const context = req.context;

    let workspace: WorkspaceModel;
    let member: ConfirmedMemberDBScheme;
    let plan: PlanDBScheme;

    if (!data || !data.workspaceId || !data.tariffPlanId || !data.userId) {
      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, '[Billing / Check] There is no necessary data in the request', body);

      return;
    }

    const { workspaceId, userId, tariffPlanId } = data;

    try {
      workspace = await this.getWorkspace(req, workspaceId);
      member = await this.getMember(userId, workspace);
      plan = await this.getPlan(req, tariffPlanId);
    } catch (err) {
      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, `[Billing / Check] ${err.toString()}`, body);

      return;
    }

    if (+body.Amount !== plan.monthlyCharge) {
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
          amount: +body.Amount * PENNY_MULTIPLIER,
          userId: member._id,
          tariffPlanId: plan._id,
        },
        dtCreated: new Date(),
      });
    } catch (err) {
      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, `[Billing / Check] Business operation wasn't created`, body);

      return;
    }

    telegram.sendMessage(`✅ [Billing / Check] All checks passed successfully *${workspace.name}*`, TelegramBotURLs.Money)
      .catch(e => console.error('Error while sending message to Telegram: ' + e));
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

    let data;

    try {
      data = checksumService.parseAndVerifyData(body.Data);
    } catch (e) {
      this.sendError(res, CheckCodes.SUCCESS, `[Billing / Pay] Can't parse data from body`, body);

      return;
    }

    if (!data || !data.workspaceId || !data.tariffPlanId || !data.userId) {
      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] No workspace, tariff plan or user id in request body`, body);

      return;
    }

    let businessOperation;
    let workspace;
    let tariffPlan;
    let user;

    try {
      businessOperation = await this.getBusinessOperation(req, body.TransactionId.toString());
      workspace = await this.getWorkspace(req, data.workspaceId);
      tariffPlan = await this.getPlan(req, data.tariffPlanId);
      user = await this.getUser(req, data.userId);
    } catch (e) {
      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Can't get data from Database ${e.toString()}`, body);

      return;
    }

    try {
      await businessOperation.setStatus(BusinessOperationStatus.Confirmed);
      await workspace.resetBillingPeriod();
      await workspace.changePlan(tariffPlan._id);
    } catch (e) {
      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Can't update workspace billing data ${e.toString()}`, body);

      return;
    }

    let accountId = workspace.accountId;

    try {
      if (!workspace.accountId) {
        accountId = (await context.accounting.createAccount({
          name: `WORKSPACE:${workspace.name}`,
          type: AccountType.LIABILITY,
          currency: Currency.USD,
        })).recordId;
        await workspace.setAccountId(accountId);
      }

      await context.accounting.payOnce({
        accountId: accountId,
        amount: tariffPlan.monthlyCharge * PENNY_MULTIPLIER,
        description: `Account replenishment to pay for the tariff plan with id ${tariffPlan._id}. CloudPayments transaction ID: ${body.TransactionId}`,
      });

      await context.accounting.purchase({
        accountId,
        amount: tariffPlan.monthlyCharge * PENNY_MULTIPLIER,
        description: `Charging for tariff plan with id ${tariffPlan._id}. CloudPayments transaction ID: ${body.TransactionId}`,
      });
    } catch (e) {
      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Error while creating operations in accounting ${e.toString()}`, body);

      return;
    }

    try {
      await publish('cron-tasks', 'cron-tasks/limiter', JSON.stringify({
        type: 'check-single-workspace',
        workspaceId: data.workspaceId,
      }));
    } catch (e) {
      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Error while sending task to limiter worker ${e.toString()}`, body);

      return;
    }

    try {
      const senderWorkerTask: PlanProlongationNotificationTask = {
        type: SenderWorkerTaskType.PlanProlongation,
        payload: data,
      };

      await sendNotification(user, senderWorkerTask);
    } catch (e) {
      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Error while sending notification to the user ${e.toString()}`, body);

      return;
    }

    telegram.sendMessage(`✅ [Billing / Pay] Payment passed successfully for *${workspace.name}*`, TelegramBotURLs.Money)
      .catch(e => console.error('Error while sending message to Telegram: ' + e));

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
   * Get user by its id
   *
   * @param req - express request
   * @param userId - id of user to fetch
   */
  private async getUser(req: express.Request, userId: string): Promise<UserModel> {
    const user = await req.context.factories.usersFactory.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Get business operation by transaction id
   *
   * @param req - express request
   * @param transactionId - id of the transaction for fetching business operation
   */
  private async getBusinessOperation(req: express.Request, transactionId: string): Promise<BusinessOperationModel> {
    const businessOperation = await req.context.factories.businessOperationsFactory.getBusinessOperationByTransactionId(transactionId);

    if (!businessOperation) {
      throw new Error('Business operation not found');
    }

    return businessOperation;
  }

  /**
   * Get member info
   *
   * @param userId - id of current user
   * @param workspace - workspace data
   */
  private async getMember(userId: string, workspace: WorkspaceModel): Promise<ConfirmedMemberDBScheme> {
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

    telegram.sendMessage(`❌ ${errorText}`, TelegramBotURLs.Money)
      .catch(e => console.error('Error while sending message to Telegram: ' + e));
    HawkCatcher.send(new Error(errorText), backtrace);
  }
}
