import express from 'express';
import * as telegram from '../utils/telegram';
import { TelegramBotURLs } from '../utils/telegram';
import {
  CheckCodes,
  CheckRequest,
  CheckResponse,
  FailCodes,
  FailRequest,
  FailResponse,
  PayCodes,
  PayRequest,
  PayResponse,
  RecurrentCodes,
  RecurrentRequest,
  RecurrentResponse
} from './types';
import { ReasonCodesTranscript, SubscriptionStatus } from './types/enums';
import {
  BankCard,
  BusinessOperationStatus,
  BusinessOperationType,
  ConfirmedMemberDBScheme,
  PayloadOfWorkspacePlanPurchase,
  PlanDBScheme,
  PlanProlongationPayload
} from '@hawk.so/types';
import WorkspaceModel from '../models/workspace';
import HawkCatcher from '@hawk.so/nodejs';
import { publish } from '../rabbitmq';
import sendNotification from '../utils/personalNotifications';
import {
  PaymentFailedNotificationTask,
  PaymentSuccessNotificationTask,
  SenderWorkerTaskType
} from '../types/userNotifications';
import BusinessOperationModel from '../models/businessOperation';
import UserModel from '../models/user';
import checksumService from '../utils/checksumService';
import { WebhookData } from './types/request';
import { PaymentData } from './types/paymentData';
import cloudPaymentsApi from '../utils/cloudPaymentsApi';
import PlanModel from '../models/plan';
import { ClientApi, ClientService, CustomerReceiptItem, ReceiptApi, ReceiptTypes, TaxationSystem } from 'cloudpayments';
import { ComposePaymentPayload } from './types/composePaymentPayload';

const PENNY_MULTIPLIER = 100;

interface ComposePaymentRequest extends express.Request {
  query: ComposePaymentPayload & { [key: string]: any };
  context: import('../types/graphql').ResolverContextBase;
};

/**
 * Class for describing the logic of payment routes
 */
export default class CloudPaymentsWebhooks {
  private readonly clientService = new ClientService({
    publicId: process.env.CLOUDPAYMENTS_PUBLIC_ID || '',
    privateKey: process.env.CLOUDPAYMENTS_SECRET || '',
  })

  /**
   * Receipt API instance to call receipt methods
   */
  private readonly receiptApi: ReceiptApi;

  /**
   * Client API instance to call CloundPayments API
   */
  private readonly clientApi: ClientApi;

  /**
   * Creates class instance
   */
  constructor() {
    this.receiptApi = this.clientService.getReceiptApi();
    this.clientApi = this.clientService.getClientApi();
  }

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
  private async composePayment(req: ComposePaymentRequest, res: express.Response): Promise<void> {
    const { workspaceId, tariffPlanId, shouldSaveCard } = req.query;
    const userId = req.context.user.id;

    if (!workspaceId || !tariffPlanId || !userId) {
      this.sendError(res, 1, `[Billing / Compose payment] No workspace, tariff plan or user id in request body
Details:
workspaceId: ${workspaceId}
tariffPlanId: ${tariffPlanId}
userId: ${userId}`
      , req.query);

      return;
    }

    let workspace;
    let tariffPlan;

    try {
      workspace = await this.getWorkspace(req, workspaceId);
      tariffPlan = await this.getPlan(req, tariffPlanId);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, 1, `[Billing / Compose payment] Can't get data from Database ${error.toString()}`, req.query);

      return;
    }

    try {
      await this.getMember(userId, workspace);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, 1, `[Billing / Compose payment] Can't compose payment due to error: ${error.toString()}`, req.query);

      return;
    }
    const invoiceId = this.generateInvoiceId(tariffPlan, workspace);

    const isCardLinkOperation = workspace.tariffPlanId.toString() === tariffPlanId && !workspace.isTariffPlanExpired();

    // Calculate next payment date
    const lastChargeDate = new Date(workspace.lastChargeDate);
    const now = new Date();
    let nextPaymentDate: Date;

    if (isCardLinkOperation) {
      nextPaymentDate = new Date(lastChargeDate);
    } else {
      nextPaymentDate = new Date(now);
    }

    if (workspace.isDebug) {
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);
    } else {
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
    }

    let checksum;

    try {
      const checksumData = isCardLinkOperation ? {
        isCardLinkOperation: true,
        workspaceId: workspace._id.toString(),
        userId: userId,
        nextPaymentDate: nextPaymentDate.toISOString(),
      } : {
        workspaceId: workspace._id.toString(),
        userId: userId,
        tariffPlanId: tariffPlan._id.toString(),
        shouldSaveCard: shouldSaveCard === 'true',
        nextPaymentDate: nextPaymentDate.toISOString(),
      };

      checksum = await checksumService.generateChecksum(checksumData);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, 1, `[Billing / Compose payment] Can't generate checksum: ${error.toString()}`, req.query);

      return;
    }

    this.handleSendingToTelegramError(telegram.sendMessage(`✅ [Billing / Compose payment]

card link operation: ${isCardLinkOperation}
amount: ${+tariffPlan.monthlyCharge} RUB
last charge date: ${workspace.lastChargeDate?.toISOString()}
next payment date: ${nextPaymentDate.toISOString()}
workspace id: ${workspace._id.toString()}
debug: ${Boolean(workspace.isDebug)}`
    , TelegramBotURLs.Money));

    res.send({
      invoiceId,
      plan: {
        id: tariffPlan._id.toString(),
        name: tariffPlan.name,
        monthlyCharge: tariffPlan.monthlyCharge,
      },
      isCardLinkOperation,
      currency: 'RUB',
      checksum,
      nextPaymentDate: nextPaymentDate.toISOString(),
    });
  }

  /**
   * Generates invoice id for payment
   *
   * @param tariffPlan - tariff plan to generate invoice id
   * @param workspace - workspace data to generate invoice id
   */
  private generateInvoiceId(tariffPlan: PlanDBScheme, workspace: WorkspaceModel): string {
    const now = new Date();

    return `${workspace.name} ${now.getDate()}/${now.getMonth() + 1} ${tariffPlan.name}`;
  }

  /**
   * Route to confirm the correctness of a user's payment
   * https://developers.cloudpayments.ru/#check
   *
   * @param req - cloudpayments request with payment details
   * @param res - check result code
   */
  private async check(req: express.Request, res: express.Response): Promise<void> {
    const context = req.context;
    const body: CheckRequest = req.body;
    let data;

    console.log('💎 CloudPayments /check request', body);

    try {
      data = await this.getDataFromRequest(req);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, `[Billing / Check] Invalid request: ${error.toString()}`, body);

      return;
    }

    /** Data validation */
    if (data.isCardLinkOperation) {
      if (!data.userId || !data.workspaceId) {
        this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, '[Billing / Check] There is no necessary data in the card linking request', req.body);

        return;
      }
    } else {
      if (!data.userId || !data.workspaceId || !data.tariffPlanId) {
        this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, '[Billing / Check] There is no necessary data in the request', body);

        return;
      }
    }

    let workspace: WorkspaceModel;
    let member: ConfirmedMemberDBScheme;
    let plan: PlanDBScheme;
    let planId: string;

    const { workspaceId, userId, tariffPlanId } = data;

    try {
      workspace = await this.getWorkspace(req, workspaceId);
      member = await this.getMember(userId, workspace);
      planId = data.isCardLinkOperation ? workspace.tariffPlanId.toString() : tariffPlanId;
      plan = await this.getPlan(req, planId);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, `[Billing / Check] ${error.toString()}`, body);

      return;
    }

    const recurrentPaymentSettings = data.cloudPayments?.recurrent;

    /**
     * The amount will be considered correct if it is equal to the cost of the tariff plan.
     * Also, the cost will be correct if it is a payment to activate the subscription.
     */
    const isRightAmount = +body.Amount === plan.monthlyCharge || recurrentPaymentSettings?.startDate;

    if (!isRightAmount) {
      this.sendError(res, CheckCodes.WRONG_AMOUNT, `[Billing / Check] Amount does not equal to plan monthly charge`, body);

      return;
    }

    /**
     * Create business operation about creation of subscription
     */
    try {
      await context.factories.businessOperationsFactory.create<PayloadOfWorkspacePlanPurchase>({
        transactionId: body.TransactionId.toString(),
        type: data.isCardLinkOperation ? BusinessOperationType.CardLinkCharge : BusinessOperationType.WorkspacePlanPurchase,
        status: BusinessOperationStatus.Pending,
        payload: {
          workspaceId: workspace._id,
          amount: +body.Amount,
          currency: body.Currency,
          userId: member._id,
          tariffPlanId: plan._id,
        },
        dtCreated: new Date(),
      });
    } catch (err) {
      const error = err as Error;

      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, `[Billing / Check] Business operation wasn't created: ${error.toString()}`, body);

      res.json({
        code: CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED,
      } as CheckResponse);

      return;
    }

    telegram.sendMessage(`✅ [Billing / Check] All checks passed successfully «${workspace.name}»`, TelegramBotURLs.Money)
      .catch(e => console.error('Error while sending message to Telegram: ' + e));

    HawkCatcher.send(new Error('[Billing / Check] All checks passed successfully'), body as any);

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
    let data;

    console.log('💎 CloudPayments /pay request', body);

    try {
      data = await this.getDataFromRequest(req);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, CheckCodes.SUCCESS, `[Billing / Pay] Invalid request: ${error.toString()}`, body);

      return;
    }

    /** Data validation */
    if (data.isCardLinkOperation) {
      if (!data.userId || !data.workspaceId) {
        this.sendError(res, PayCodes.SUCCESS, '[Billing / Pay] No workspace or user id in request body', req.body);

        return;
      }
    } else {
      if (!data.workspaceId || !data.tariffPlanId || !data.userId) {
        this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] No workspace, tariff plan or user id in request body`, body);

        return;
      }
    }

    let businessOperation;
    let workspace;
    let tariffPlan;
    let user;
    let planId;

    try {
      businessOperation = await this.getBusinessOperation(req, body.TransactionId.toString());
      workspace = await this.getWorkspace(req, data.workspaceId);
      user = await this.getUser(req, data.userId);
      planId = data.isCardLinkOperation ? workspace.tariffPlanId.toString() : data.tariffPlanId;
      tariffPlan = await this.getPlan(req, planId);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Can't get data from Database ${error.toString()}`, body);

      return;
    }

    try {
      await businessOperation.setStatus(BusinessOperationStatus.Confirmed);
      await workspace.changePlan(tariffPlan._id);

      const subscriptionId = body.SubscriptionId;

      /**
       * Cancellation of the current subscription if:
       * 1) the user pays manually (the workspace has an active subscription, but the request body does not)
       * 2) if payment is made for another subscription (subscriptions id are not equal)
       */
      if (workspace.subscriptionId) {
        if (!subscriptionId || subscriptionId !== workspace.subscriptionId) {
          await this.clientApi.cancelSubscription({
            Id: workspace.subscriptionId,
          });
        }
      }

      if (subscriptionId) {
        await workspace.setSubscriptionId(subscriptionId);
      }
    } catch (e) {
      const error = e as Error;

      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Can't update workspace billing data ${error.toString()}`, body);

      return;
    }

    // let accountId = workspace.accountId;

    /*
     * try {
     *   if (!workspace.accountId) {
     *     accountId = (await context.accounting.createAccount({
     *       name: `WORKSPACE:${workspace.name}`,
     *       type: AccountType.LIABILITY,
     *       currency: Currency.RUB,
     *     })).recordId;
     *     await workspace.setAccountId(accountId);
     *   }
     */

    /*
     *   await context.accounting.payOnce({
     *     accountId: accountId,
     *     amount: tariffPlan.monthlyCharge * PENNY_MULTIPLIER,
     *     description: `Account replenishment to pay for the tariff plan with id ${tariffPlan._id}. CloudPayments transaction ID: ${body.TransactionId}`,
     *   });
     */

    /*
     *   await context.accounting.purchase({
     *     accountId,
     *     amount: tariffPlan.monthlyCharge * PENNY_MULTIPLIER,
     *     description: `Charging for tariff plan with id ${tariffPlan._id}. CloudPayments transaction ID: ${body.TransactionId}`,
     *   });
     * } catch (e) {
     *   const error = e as Error;
     */

    //   this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Error while creating operations in accounting ${error.toString()}`, body);

    /*
     *   return;
     * }
     */

    try {
      await publish('cron-tasks', 'cron-tasks/limiter', JSON.stringify({
        type: 'unblock-workspace',
        workspaceId: data.workspaceId,
      }));
    } catch (e) {
      const error = e as Error;

      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Error while sending task to limiter worker ${error.toString()}`, body);

      return;
    }

    try {
      // todo: add plan-prolongation notification if it was a payment by subscription
      const senderWorkerTask: PaymentSuccessNotificationTask = {
        type: SenderWorkerTaskType.PaymentSuccess,
        payload: {
          workspaceId: data.workspaceId,
          tariffPlanId: planId,
          userId: data.userId,
        },
      };

      await sendNotification(user, senderWorkerTask);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Error while sending notification to the user ${error.toString()}`, body);

      return;
    }

    try {
      if (data.shouldSaveCard) {
        const cardData = this.getCardData(body);

        if (cardData) {
          await user.saveNewBankCard(cardData);
        }
      }
    } catch (e) {
      const error = e as Error;

      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Error while saving user card: ${error.toString()}`, body);

      return;
    }

    try {
      /**
       * Refund the money that were charged to link a card
       */
      if (data.isCardLinkOperation) {
        await cloudPaymentsApi.cancelPayment(body.TransactionId);

        const member = await this.getMember(data.userId, workspace);
        const plan = await this.getPlan(req, planId);

        /**
         * Create business operation about refund
         */
        await req.context.factories.businessOperationsFactory.create<PayloadOfWorkspacePlanPurchase>({
          transactionId: body.TransactionId.toString(),
          type: BusinessOperationType.CardLinkRefund,
          status: BusinessOperationStatus.Confirmed,
          payload: {
            workspaceId: workspace._id,
            amount: +body.Amount * PENNY_MULTIPLIER * -1,
            currency: body.Currency,
            userId: member._id,
            tariffPlanId: plan._id,
          },
          dtCreated: new Date(),
        });

        this.handleSendingToTelegramError(telegram.sendMessage(`✅ [Billing / Pay] Card linked

workspace id: ${workspace._id}
date of operation: ${body.DateTime}
first payment date: ${data.cloudPayments?.recurrent.startDate}
card link charge: ${+body.Amount} ${body.Currency}
plan monthly charge: ${data.cloudPayments?.recurrent.amount} ${body.Currency}`
        , TelegramBotURLs.Money));
      } else {
        /**
         * Russia code from ISO 3166-1
         */
        const RUSSIA_ISO_CODE = 'RU';

        /**
         * Send receipt only in case that user pays from russian card
         */
        const userEmail = body.IssuerBankCountry === RUSSIA_ISO_CODE ? user.email : undefined;

        await this.sendReceipt(workspace, tariffPlan, userEmail);

        this.handleSendingToTelegramError(telegram.sendMessage(`✅ [Billing / Pay] New payment

amount: ${+body.Amount} ${body.Currency}
next payment date: ${data.cloudPayments?.recurrent.startDate}
workspace id: ${workspace._id}
date of operation: ${body.DateTime}
subscription id: ${body.SubscriptionId}`
        , TelegramBotURLs.Money));
      }
    } catch (e) {
      const error = e as Error;

      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Error trying to refund for card linking occured: ${error.toString()}`, body);

      return;
    }

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
    const body: FailRequest = req.body;
    let data: PlanProlongationPayload;

    console.log('💎 CloudPayments /fail request', body);

    try {
      data = await this.getDataFromRequest(req);
    } catch (e) {
      this.sendError(res, FailCodes.SUCCESS, `[Billing / Fail] Invalid request`, body);

      return;
    }

    let businessOperation;
    let workspace;
    let user;

    /**
     * @todo handle card linking and update business operation status
     */

    if (!data.workspaceId || !data.userId || !data.tariffPlanId) {
      this.sendError(res, FailCodes.SUCCESS, `[Billing / Fail] No workspace or user id or plan id in request body`, body);

      return;
    }

    try {
      businessOperation = await this.getBusinessOperation(req, body.TransactionId.toString());
      workspace = await this.getWorkspace(req, data.workspaceId);
      user = await this.getUser(req, data.userId);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, FailCodes.SUCCESS, `[Billing / Fail] ${error.toString()}`, body);

      return;
    }

    try {
      await businessOperation.setStatus(BusinessOperationStatus.Rejected);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, FailCodes.SUCCESS, `[Billing / Fail] Can't update business operation status ${error.toString()}`, body);

      return;
    }

    try {
      const senderWorkerTask: PaymentFailedNotificationTask = {
        type: SenderWorkerTaskType.PaymentFailed,
        payload: {
          workspaceId: data.workspaceId,
          reason: ReasonCodesTranscript[body.ReasonCode],
        },
      };

      await sendNotification(user, senderWorkerTask);
    } catch (e) {
      const error = e as Error;

      this.sendError(res, FailCodes.SUCCESS, `[Billing / Fail] Error while sending notification to the user ${error.toString()}`, body);

      return;
    }

    this.handleSendingToTelegramError(telegram.sendMessage(`❌ [Billing / Fail] Transaction failed for «${workspace.name}»`, TelegramBotURLs.Money));

    HawkCatcher.send(new Error('[Billing / Fail] Transaction failed'), body as any);

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
    const body: RecurrentRequest = req.body;
    const context = req.context;

    console.log('💎 CloudPayments /recurrent request', body);

    this.handleSendingToTelegramError(telegram.sendMessage(`✅ [Billing / Recurrent] New recurrent transaction

amount: ${+body.Amount} ${body.Currency}
next payment date: ${body.NextTransactionDate}
workspace id: ${body.AccountId}
subscription id: ${body.Id}
status: ${body.Status}`
    , TelegramBotURLs.Money));
    HawkCatcher.send(new Error(`[Billing / Recurrent] New recurrent event with ${body.Status} status`), req.body);

    switch (body.Status) {
      case SubscriptionStatus.CANCELLED:
      case SubscriptionStatus.REJECTED: {
        let workspace;

        try {
          /**
           * If there is a workspace with subscription id then subscription was cancelled via CloudPayments admin panel (or other no garage way)
           * We need to remove subscription id from workspace
           */
          workspace = await context.factories.workspacesFactory.findBySubscriptionId(body.Id);
        } catch (e) {
          const error = e as Error;

          this.sendError(res, RecurrentCodes.SUCCESS, `[Billing / Recurrent] Can't get data from database: ${error.toString()}`, {
            body,
            workspace,
          });

          return;
        }

        if (!workspace) {
          /**
           * If no workspace found by subscription id then subscription is cancelled via garage and subscription id was set to null in mutation before this hook executed
           * No need to send error
           */

          return;
        }

        try {
          await workspace.setSubscriptionId(null);
        } catch (e) {
          const error = e as Error;

          this.sendError(res, RecurrentCodes.SUCCESS, `[Billing / Recurrent] Can't remove subscriptionId from workspace: ${error.toString()}`, {
            body,
            workspace,
          });
        }
      }
    }

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
  private async getPlan(req: express.Request, tariffPlanId: string): Promise<PlanModel> {
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

    console.log(errorText, backtrace);
    console.log('We responded with an error code to CloudPayments: ' + errorCode);

    this.handleSendingToTelegramError(telegram.sendMessage(`❌ ${errorText}`, TelegramBotURLs.Money));

    HawkCatcher.send(new Error(errorText), backtrace);
  }

  /**
   * Parses request body and returns data from it
   *
   * @param req - request with necessary data
   */
  private async getDataFromRequest(req: express.Request): Promise<PaymentData> {
    const context = req.context;
    const body: CheckRequest | PayRequest | FailRequest = req.body;

    /**
     * If Data is not presented in body means there is a recurring payment
     * Data field is presented only in one-time payment requests or subscription initial request
     */
    if (body.Data) {
      const parsedData = JSON.parse(body.Data || '{}') as WebhookData;

      return {
        ...checksumService.parseAndVerifyChecksum(parsedData.checksum),
        ...parsedData,
      };
    }

    const subscriptionId = body.SubscriptionId;
    const userId = body.AccountId;

    if (!subscriptionId || !userId) {
      throw new Error('Invalid request: no subscription or user id');
    }

    const workspace = await context.factories.workspacesFactory.findBySubscriptionId(subscriptionId);

    if (workspace) {
      return {
        workspaceId: workspace._id.toString(),
        tariffPlanId: workspace.tariffPlanId.toString(),
        userId,
        shouldSaveCard: false,
        isCardLinkOperation: false,
      };
    }

    throw new Error('Invalid request: no necessary data');
  }

  /**
   * Wrapper for telegram promise
   * @param promise - promise to handle
   */
  private handleSendingToTelegramError(promise: Promise<void>): void {
    promise.catch(e => console.error('Error while sending message to Telegram: ' + e));
  }

  /**
   * Parses body and returns card data
   * @param request - request body to parse
   */
  private getCardData(request: PayRequest): Omit<BankCard, 'id'> | null {
    if (!request.CardType || !request.CardExpDate || !request.CardLastFour || !request.CardFirstSix || !request.Token) {
      return null;
    }

    return {
      cardExpDate: request.CardExpDate,
      firstSix: +request.CardFirstSix,
      lastFour: +request.CardLastFour,
      token: request.Token,
      type: request.CardType,
    };
  }

  /**
   * Send receipt to user after successful payment
   *
   * @param workspace - workspace for which payment is made
   * @param tariff - paid tariff plan
   * @param userMail - user email address
   */
  private async sendReceipt(workspace: WorkspaceModel, tariff: PlanModel, userMail?: string): Promise<void> {
    /**
     * A general tax that applies to all commercial activities
     * involving the production and distribution of goods and the provision of services
     * Also known as "НДС" in Russia
     */
    const VALUE_ADDED_TAX = 0;

    const item: CustomerReceiptItem = {
      amount: tariff.monthlyCharge,
      label: `${tariff.name} tariff plan`,
      price: tariff.monthlyCharge,
      vat: VALUE_ADDED_TAX,
      quantity: 1,
    };

    await this.receiptApi.createReceipt(
      {
        Type: ReceiptTypes.Income,
        Inn: Number(process.env.LEGAL_ENTITY_INN),
      },
      {
        Items: [ item ],
        email: userMail,
        taxationSystem: TaxationSystem.SIMPLIFIED_INCOME,
      }
    );
  }
}
