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
} from 'hawk.types';
import { AccountType, Currency, PENNY_MULTIPLIER } from 'codex-accounting-sdk';
import WorkspaceModel from '../models/workspace';
import HawkCatcher from '@hawk.so/nodejs';
import { publish } from '../rabbitmq';
import sendNotification from '../utils/personalNotifications';
import {
  PaymentFailedNotificationTask,
  PaymentSuccessNotificationTask,
  SenderWorkerTaskType
} from '../types/personalNotifications';
import BusinessOperationModel from '../models/businessOperation';
import UserModel from '../models/user';
import checksumService from '../utils/checksumService';
import { WebhookData } from './types/request';
import { PaymentData } from './types/paymentData';
import cloudPaymentsApi from '../utils/cloudPaymentsApi';
import PlanModel from '../models/plan';
import { ClientService, CustomerReceiptItem, ReceiptApi, ReceiptTypes, TaxationSystem } from 'cloudpayments';

/**
 * Custom data of the plan prolongation request
 */
type PlanProlongationData = PlanProlongationPayload & PaymentData;

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
   * Creates class instance
   */
  constructor() {
    this.receiptApi = this.clientService.getReceiptApi();
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
  private async composePayment(req: express.Request, res: express.Response): Promise<void> {
    const { workspaceId, tariffPlanId, shouldSaveCard } = req.query as Record<string, string>;
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
    const invoiceId = this.generateInvoiceId(tariffPlan, workspace);

    let checksum;

    try {
      checksum = await checksumService.generateChecksum({
        workspaceId: workspace._id.toString(),
        userId: userId,
        tariffPlanId: tariffPlan._id.toString(),
        shouldSaveCard: shouldSaveCard === 'true',
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

    try {
      data = await this.getDataFromRequest(req);
    } catch (e) {
      this.sendError(res, CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED, `[Billing / Check] Invalid request`, body);

      return;
    }

    let workspace: WorkspaceModel;
    let member: ConfirmedMemberDBScheme;
    let plan: PlanDBScheme;

    if (!data.workspaceId || !data.tariffPlanId || !data.userId) {
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

    telegram.sendMessage(`✅ [Billing / Check] All checks passed successfully «${workspace.name}»`, TelegramBotURLs.Money)
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
      data = await this.getDataFromRequest(req);
    } catch (e) {
      this.sendError(res, CheckCodes.SUCCESS, `[Billing / Pay] Invalid request`, body);

      return;
    }

    if (!data.workspaceId || !data.tariffPlanId || !data.userId) {
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

      const subscriptionId = body.SubscriptionId;

      if (subscriptionId) {
        await workspace.setSubscriptionId(subscriptionId);
      }
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
      // todo: add plan-prolongation notification if it was a payment by subscription
      const senderWorkerTask: PaymentSuccessNotificationTask = {
        type: SenderWorkerTaskType.PaymentSuccess,
        payload: {
          workspaceId: data.workspaceId,
          tariffPlanId: data.tariffPlanId,
          userId: data.userId,
        },
      };

      await sendNotification(user, senderWorkerTask);
    } catch (e) {
      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Error while sending notification to the user ${e.toString()}`, body);

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
      this.sendError(res, PayCodes.SUCCESS, `[Billing / Pay] Error while saving user card: ${e.toString()}`, body);

      return;
    }

    try {
      /**
       * Cancel payment if it is deferred
       */
      if (data.cloudPayments?.recurrent?.startDate) {
        this.handleSendingToTelegramError(telegram.sendMessage(`✅ [Billing / Pay] Recurrent payments activated for «${workspace.name}». 1$ charged`, TelegramBotURLs.Money));
        await cloudPaymentsApi.cancelPayment(body.TransactionId);
        this.handleSendingToTelegramError(telegram.sendMessage(`✅ [Billing / Pay] Recurrent payments activated for «${workspace.name}». 1$ returned`, TelegramBotURLs.Money));
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

        this.handleSendingToTelegramError(telegram.sendMessage(`✅ [Billing / Pay] Payment passed successfully for «${workspace.name}»`, TelegramBotURLs.Money));
      }
    } catch (e) {
      console.log(e);
      this.sendError(res, PayCodes.SUCCESS, e, body);

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

    try {
      data = await this.getDataFromRequest(req);
    } catch (e) {
      this.sendError(res, FailCodes.SUCCESS, `[Billing / Fail] Invalid request`, body);

      return;
    }

    let businessOperation;
    let workspace;
    let user;

    if (!data.workspaceId || !data.userId || !data.tariffPlanId) {
      this.sendError(res, FailCodes.SUCCESS, `[Billing / Fail] No workspace or user id or plan id in request body`, body);

      return;
    }

    try {
      businessOperation = await this.getBusinessOperation(req, body.TransactionId.toString());
      workspace = await this.getWorkspace(req, data.workspaceId);
      user = await this.getUser(req, data.userId);
    } catch (e) {
      this.sendError(res, FailCodes.SUCCESS, `[Billing / Fail] ${e.toString()}`, body);

      return;
    }

    try {
      await businessOperation.setStatus(BusinessOperationStatus.Rejected);
    } catch (e) {
      this.sendError(res, FailCodes.SUCCESS, `[Billing / Fail] Can't update business operation status ${e.toString()}`, body);

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
      this.sendError(res, FailCodes.SUCCESS, `[Billing / Fail] Error while sending notification to the user ${e.toString()}`, body);

      return;
    }

    this.handleSendingToTelegramError(telegram.sendMessage(`✅ [Billing / Fail] Transaction failed for «${workspace.name}»`, TelegramBotURLs.Money));

    HawkCatcher.send(new Error('[Billing / Fail] Transaction failed'), body);

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

    switch (body.Status) {
      case SubscriptionStatus.CANCELLED:
      case SubscriptionStatus.REJECTED: {
        try {
          const workspace = await context.factories.workspacesFactory.findBySubscriptionId(body.Id);

          if (workspace) {
            await workspace.setSubscriptionId(null);
          } else {
            throw new Error('There is no workspace with provided subscription id');
          }
        } catch {
          this.sendError(res, RecurrentCodes.SUCCESS, `[Billing / Recurrent] Can't remove subscriptionId from workspace`, body);
        }
      }
    }

    this.handleSendingToTelegramError(telegram.sendMessage(`[Billing / Recurrent] New recurrent event with ${body.Status} status`, TelegramBotURLs.Money));
    HawkCatcher.send(new Error(`[Billing / Recurrent] New recurrent event with ${body.Status} status`), req.body);

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

    this.handleSendingToTelegramError(telegram.sendMessage(`❌ ${errorText}`, TelegramBotURLs.Money));

    HawkCatcher.send(new Error(errorText), backtrace);
  }

  /**
   * Parses request body and returns data from it
   *
   * @param req - request with necessary data
   */
  private async getDataFromRequest(req: express.Request): Promise<PlanProlongationData> {
    const context = req.context;
    const body: CheckRequest = req.body;

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
    const VALUE_ADDED_TAX = 20;

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
        taxationSystem: TaxationSystem.GENERAL,
      }
    );
  }
}
