import '../../src/env-test';

const receiptApi = {
  createReceipt: jest.fn().mockResolvedValue(undefined),
};

jest.mock('cloudpayments', () => ({
  ClientService: jest.fn().mockImplementation(() => ({
    getReceiptApi: () => receiptApi,
    getClientApi: () => ({
      cancelSubscription: jest.fn().mockResolvedValue(undefined),
    }),
  })),
  ReceiptTypes: { Income: 'Income' },
  TaxationSystem: { SIMPLIFIED_INCOME: 'SIMPLIFIED_INCOME' },
}));

jest.mock('../../src/utils/cloudPaymentsApi', () => ({
  __esModule: true,
  default: {
    cancelPayment: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/mongo', () => ({
  databases: {
    hawk: {
      collection: jest.fn().mockReturnValue({}),
    },
  },
}));

jest.mock('../../src/rabbitmq', () => ({
  publish: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/telegram', () => ({
  sendMessage: jest.fn().mockResolvedValue(undefined),
  TelegramBotURLs: { Money: 'money' },
}));

jest.mock('../../src/utils/personalNotifications', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@hawk.so/nodejs', () => ({
  __esModule: true,
  default: { send: jest.fn() },
}));

import { ObjectId } from 'mongodb';
import {
  BusinessOperationStatus,
  BusinessOperationType
} from '@hawk.so/types';
import CloudPaymentsWebhooks from '../../src/billing/cloudpayments';
import { CheckCodes, FailCodes, PayCodes } from '../../src/billing/types';
import checksumService from '../../src/utils/checksumService';
import sendNotification from '../../src/utils/personalNotifications';

process.env.JWT_SECRET_BILLING_CHECKSUM = 'checksum_secret';
process.env.CLOUDPAYMENTS_PUBLIC_ID = 'public';
process.env.CLOUDPAYMENTS_SECRET = 'secret';
process.env.LEGAL_ENTITY_INN = '1234567890';

function createPlan() {
  return {
    _id: new ObjectId(),
    name: 'Basic',
    monthlyCharge: 1000,
    monthlyChargeCurrency: 'RUB',
    eventsLimit: 1000,
    isDefault: false,
    isHidden: false,
  };
}

function createContext(options: {
  promoCodeId?: string;
  reserve?: jest.Mock;
  finalize?: jest.Mock;
  release?: jest.Mock;
  existingOperation?: boolean;
  operationLookup?: jest.Mock;
} = {}) {
  const plan = createPlan();
  const workspace = {
    _id: new ObjectId(),
    name: 'Workspace',
    tariffPlanId: plan._id,
    subscriptionId: null,
    isDebug: false,
    getMemberInfo: jest.fn().mockResolvedValue({
      _id: new ObjectId(),
      isAdmin: true,
    }),
    changePlan: jest.fn().mockResolvedValue(1),
    setSubscriptionId: jest.fn().mockResolvedValue(undefined),
  };
  const user = {
    _id: new ObjectId(),
    email: 'user@test.com',
    saveNewBankCard: jest.fn().mockResolvedValue(undefined),
  };
  const businessOperation = {
    _id: new ObjectId(),
    type: options.promoCodeId
      ? BusinessOperationType.WorkspacePlanPurchase
      : BusinessOperationType.CardLinkCharge,
    status: BusinessOperationStatus.Pending,
    setStatus: jest.fn().mockResolvedValue(undefined),
  };
  const createOperation = jest.fn().mockResolvedValue(businessOperation);
  const operationLookup = options.operationLookup ?? jest.fn().mockResolvedValue(
    options.existingOperation ? businessOperation : null
  );
  const promoCodeService = {
    reserve: options.reserve ?? jest.fn().mockResolvedValue({
      created: true,
      finalAmount: 750,
    }),
    finalize: options.finalize ?? jest.fn().mockResolvedValue(undefined),
    release: options.release ?? jest.fn().mockResolvedValue(undefined),
  };
  const context = {
    user: {
      id: user._id.toString(),
      accessTokenExpired: false,
    },
    factories: {
      workspacesFactory: {
        findById: jest.fn().mockResolvedValue(workspace),
        findBySubscriptionId: jest.fn().mockResolvedValue(workspace),
      },
      plansFactory: {
        findById: jest.fn().mockResolvedValue(plan),
      },
      usersFactory: {
        findById: jest.fn().mockResolvedValue(user),
      },
      businessOperationsFactory: {
        getBusinessOperationByTransactionId: operationLookup,
        create: createOperation,
      },
    },
    promoCodeService,
  };

  return {
    context,
    plan,
    workspace,
    user,
    businessOperation,
    createOperation,
    operationLookup,
    promoCodeService,
  };
}

async function createData(
  context: ReturnType<typeof createContext>,
  options: {
    chargeAmount?: number;
    promoCodeId?: string;
    isCardLinkOperation?: boolean;
  } = {}
) {
  const chargeAmount = options.chargeAmount ?? 1000;
  const checksum = await checksumService.generateChecksum({
    workspaceId: context.workspace._id.toString(),
    userId: context.user._id.toString(),
    tariffPlanId: context.plan._id.toString(),
    shouldSaveCard: false,
    isCardLinkOperation: options.isCardLinkOperation ?? false,
    chargeAmount,
    nextPaymentDate: new Date('2026-10-01T00:00:00.000Z').toISOString(),
    promoCodeId: options.promoCodeId,
  });

  return JSON.stringify({
    checksum,
    cloudPayments: {
      recurrent: {
        interval: 'Month',
        period: 1,
        amount: context.plan.monthlyCharge,
        startDate: new Date('2026-10-01T00:00:00.000Z').toISOString(),
      },
    },
  });
}

function createBody(transactionId: number, amount: number, Data: string) {
  return {
    TransactionId: transactionId,
    Amount: amount.toString(),
    Currency: 'RUB',
    DateTime: new Date(),
    TestMode: true,
    Status: 'Completed',
    OperationType: 'Payment',
    CardType: 'Visa',
    CardExpDate: '12/30',
    CardFirstSix: '411111',
    CardLastFour: '1111',
    Token: 'token',
    IssuerBankCountry: 'RU',
    Reason: 'DoNotHonor',
    ReasonCode: 5001,
    Data,
  };
}

function createResponse() {
  return {
    json: jest.fn(),
  };
}

describe('CloudPayments promo flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should trust signed payment fields and only accept recurrent settings from widget Data', async () => {
    // Arrange
    const setup = createContext();
    const Data = JSON.parse(await createData(setup));
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    const result = await webhooks.getDataFromRequest({
      context: setup.context,
      body: {
        Data: JSON.stringify({
          ...Data,
          workspaceId: new ObjectId().toString(),
          tariffPlanId: new ObjectId().toString(),
          chargeAmount: 1,
        }),
      },
    });

    // Assert
    expect(result).toMatchObject({
      workspaceId: setup.workspace._id.toString(),
      tariffPlanId: setup.plan._id.toString(),
      chargeAmount: 1000,
      isCardLinkOperation: false,
      cloudPayments: Data.cloudPayments,
    });
  });

  it('should reserve promo usage and create one pending operation', async () => {
    // Arrange
    const promoCodeId = new ObjectId().toString();
    const setup = createContext({ promoCodeId });
    const Data = await createData(setup, { chargeAmount: 750, promoCodeId });
    const res = createResponse();
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    await webhooks.check({
      context: setup.context,
      body: createBody(1001, 750, Data),
    }, res);

    // Assert
    expect(setup.promoCodeService.reserve).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: '1001',
      promoCodeId,
    }));
    expect(setup.createOperation).toHaveBeenCalledWith(expect.objectContaining({
      type: BusinessOperationType.WorkspacePlanPurchase,
      status: BusinessOperationStatus.Pending,
    }));
    expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.SUCCESS });
  });

  it('should keep an existing reservation and operation on /check retry', async () => {
    // Arrange
    const promoCodeId = new ObjectId().toString();
    const reserve = jest.fn().mockResolvedValue({
      created: false,
      finalAmount: 750,
    });
    const setup = createContext({
      promoCodeId,
      reserve,
      existingOperation: true,
    });
    const Data = await createData(setup, { chargeAmount: 750, promoCodeId });
    const res = createResponse();
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    await webhooks.check({
      context: setup.context,
      body: createBody(1002, 750, Data),
    }, res);

    // Assert
    expect(setup.createOperation).not.toHaveBeenCalled();
    expect(setup.promoCodeService.release).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.SUCCESS });
  });

  it('should not release an existing reservation when operation lookup fails', async () => {
    // Arrange
    const promoCodeId = new ObjectId().toString();
    const reserve = jest.fn().mockResolvedValue({
      created: false,
      finalAmount: 750,
    });
    const setup = createContext({
      promoCodeId,
      reserve,
      operationLookup: jest.fn().mockRejectedValue(new Error('mongo down')),
    });
    const Data = await createData(setup, { chargeAmount: 750, promoCodeId });
    const res = createResponse();
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    await webhooks.check({
      context: setup.context,
      body: createBody(1003, 750, Data),
    }, res);

    // Assert
    expect(setup.promoCodeService.release).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.PAYMENT_COULD_NOT_BE_ACCEPTED });
  });

  it('should reject unsigned amount changes before reserving promo usage', async () => {
    // Arrange
    const promoCodeId = new ObjectId().toString();
    const setup = createContext({ promoCodeId });
    const Data = await createData(setup, { chargeAmount: 750, promoCodeId });
    const res = createResponse();
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    await webhooks.check({
      context: setup.context,
      body: createBody(1004, 1, Data),
    }, res);

    // Assert
    expect(setup.promoCodeService.reserve).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.WRONG_AMOUNT });
  });

  it('should accept 1 RUB only when card-link intent is signed', async () => {
    // Arrange
    const setup = createContext();
    const Data = await createData(setup, {
      chargeAmount: 1,
      isCardLinkOperation: true,
    });
    const res = createResponse();
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    await webhooks.check({
      context: setup.context,
      body: createBody(1005, 1, Data),
    }, res);

    // Assert
    expect(setup.promoCodeService.reserve).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ code: CheckCodes.SUCCESS });
  });

  it('should finalize promo usage before granting the plan', async () => {
    // Arrange
    const promoCodeId = new ObjectId().toString();
    const setup = createContext({ promoCodeId, existingOperation: true });
    const Data = await createData(setup, { chargeAmount: 750, promoCodeId });
    const res = createResponse();
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    await webhooks.pay({
      context: setup.context,
      body: createBody(2001, 750, Data),
    }, res);

    // Assert
    expect(setup.promoCodeService.finalize).toHaveBeenCalledWith('2001');
    expect(setup.workspace.changePlan).toHaveBeenCalledWith(setup.plan._id);
    expect(receiptApi.createReceipt).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        Items: [expect.objectContaining({ amount: 750, price: 750 })],
      })
    );
    expect(res.json).toHaveBeenCalledWith({ code: PayCodes.SUCCESS });
  });

  it('should request a retry when promo finalization fails', async () => {
    // Arrange
    const promoCodeId = new ObjectId().toString();
    const setup = createContext({
      promoCodeId,
      existingOperation: true,
      finalize: jest.fn().mockRejectedValue(new Error('mongo down')),
    });
    const Data = await createData(setup, { chargeAmount: 750, promoCodeId });
    const res = createResponse();
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    await webhooks.pay({
      context: setup.context,
      body: createBody(2002, 750, Data),
    }, res);

    // Assert
    expect(setup.workspace.changePlan).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ code: PayCodes.TEMPORARY_ERROR });
  });

  it('should release a reservation when failed-payment checksum cannot be parsed', async () => {
    // Arrange
    const setup = createContext();
    const res = createResponse();
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    await webhooks.fail({
      context: setup.context,
      body: createBody(3001, 750, '{ invalid json'),
    }, res);

    // Assert
    expect(setup.promoCodeService.release).toHaveBeenCalledWith('3001');
    expect(res.json).toHaveBeenCalledWith({ code: FailCodes.SUCCESS });
  });

  it('should release a reservation before loading the failed business operation', async () => {
    // Arrange
    const setup = createContext({
      operationLookup: jest.fn().mockRejectedValue(new Error('mongo down')),
    });
    const Data = await createData(setup);
    const res = createResponse();
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    await webhooks.fail({
      context: setup.context,
      body: createBody(3002, 1000, Data),
    }, res);

    // Assert
    expect(setup.promoCodeService.release).toHaveBeenCalledWith('3002');
    expect(res.json).toHaveBeenCalledWith({ code: FailCodes.SUCCESS });
  });

  it('should continue failed-payment notification when reservation release fails', async () => {
    // Arrange
    const promoCodeId = new ObjectId().toString();
    const setup = createContext({
      promoCodeId,
      existingOperation: true,
      release: jest.fn().mockRejectedValue(new Error('mongo down')),
    });
    const Data = await createData(setup, { chargeAmount: 750, promoCodeId });
    const res = createResponse();
    const webhooks = new CloudPaymentsWebhooks() as any;

    // Act
    await webhooks.fail({
      context: setup.context,
      body: createBody(3001, 750, Data),
    }, res);

    // Assert
    expect(setup.businessOperation.setStatus).toHaveBeenCalledWith(BusinessOperationStatus.Rejected);
    expect(sendNotification).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ code: FailCodes.SUCCESS });
  });
});
