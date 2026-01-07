import '../../../src/env-test';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import SamlController from '../../../src/sso/saml/controller';
import { ContextFactories } from '../../../src/types/graphql';
import { WorkspaceSsoConfig } from '../../../src/sso/types';
import { WorkspaceDBScheme, UserDBScheme } from '@hawk.so/types';
import SamlService from '../../../src/sso/saml/service';
import samlStore from '../../../src/sso/saml/store';
import * as mongo from '../../../src/mongo';

/**
 * Mock dependencies
 */
jest.mock('../../../src/sso/saml/service');

/**
 * Import models AFTER mongo setup to ensure databases.hawk is initialized
 * This must be done after beforeAll sets up connections
 */
import WorkspaceModel from '../../../src/models/workspace';
import UserModel from '../../../src/models/user';

beforeAll(async () => {
  /**
   * Ensure MONGO_HAWK_DB_URL is set from MONGO_URL (set by @shelf/jest-mongodb)
   * This is a fallback in case setup.ts didn't run or MONGO_URL wasn't available then
   */
  if (process.env.MONGO_URL && !process.env.MONGO_HAWK_DB_URL) {
    process.env.MONGO_HAWK_DB_URL = process.env.MONGO_URL;
  }
  if (process.env.MONGO_URL && !process.env.MONGO_EVENTS_DB_URL) {
    process.env.MONGO_EVENTS_DB_URL = process.env.MONGO_URL;
  }

  await mongo.setupConnections();

  /**
   * Verify that databases are initialized
   */
  if (!mongo.databases.hawk) {
    throw new Error(
      `Failed to initialize MongoDB connection for tests. ` +
      `MONGO_URL: ${process.env.MONGO_URL}, ` +
      `MONGO_HAWK_DB_URL: ${process.env.MONGO_HAWK_DB_URL}`
    );
  }
});

describe('SamlController', () => {
  let controller: SamlController;
  let mockFactories: ContextFactories;
  let mockWorkspacesFactory: any;
  let mockUsersFactory: any;
  let mockSamlService: jest.Mocked<SamlService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  const testWorkspaceId = new ObjectId().toString();
  const testUserId = new ObjectId().toString();
  const testSamlConfig: WorkspaceSsoConfig['saml'] = {
    idpEntityId: 'urn:test:idp',
    ssoUrl: 'https://idp.example.com/sso',
    x509Cert: '-----BEGIN CERTIFICATE-----\nTEST_CERTIFICATE\n-----END CERTIFICATE-----',
    nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attributeMapping: {
      email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    },
  };

  /**
   * Create mock workspace with SSO enabled
   * Using partial mock object instead of real instance to avoid MongoDB connection issues in tests
   */
  function createMockWorkspace(overrides?: Partial<WorkspaceDBScheme>): Partial<WorkspaceModel> & { _id: ObjectId } {
    const workspaceData: WorkspaceDBScheme = {
      _id: new ObjectId(testWorkspaceId),
      name: 'Test Workspace',
      accountId: 'test-account-id',
      balance: 0,
      billingPeriodEventsCount: 0,
      isBlocked: false,
      lastChargeDate: new Date(),
      tariffPlanId: new ObjectId(),
      inviteHash: 'test-invite-hash',
      subscriptionId: undefined,
      sso: {
        enabled: true,
        enforced: false,
        type: 'saml',
        saml: testSamlConfig,
      },
      ...overrides,
    };

    return {
      ...workspaceData,
      getMemberInfo: jest.fn(),
      addMember: jest.fn(),
      confirmMembership: jest.fn(),
    } as any;
  }

  /**
   * Create mock user
   * Using partial mock object instead of real instance to avoid MongoDB connection issues in tests
   */
  function createMockUser(overrides?: Partial<UserDBScheme>): Partial<UserModel> & { _id: ObjectId; email?: string } {
    const userData: UserDBScheme = {
      _id: new ObjectId(testUserId),
      email: 'test@example.com',
      notifications: {
        channels: {
          email: {
            isEnabled: true,
            endpoint: 'test@example.com',
            minPeriod: 60,
          },
        },
        whatToReceive: {} as any,
      },
      ...overrides,
    };

    return {
      ...userData,
      linkSamlIdentity: jest.fn(),
      addWorkspace: jest.fn(),
      confirmMembership: jest.fn(),
      generateTokensPair: jest.fn().mockResolvedValue({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      }),
    } as any;
  }

  beforeEach(() => {
    /**
     * Clear all mocks
     */
    jest.clearAllMocks();
    samlStore.clear();

    /**
     * Setup environment variables
     */
    process.env.API_URL = 'https://api.example.com';
    process.env.GARAGE_URL = 'https://garage.example.com';
    process.env.SSO_SP_ENTITY_ID = 'urn:hawk:tracker:saml';

    /**
     * Mock factories
     */
    mockWorkspacesFactory = {
      findById: jest.fn(),
    };

    mockUsersFactory = {
      findBySamlIdentity: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    mockFactories = {
      workspacesFactory: mockWorkspacesFactory as any,
      usersFactory: mockUsersFactory as any,
      projectsFactory: {} as any,
      plansFactory: {} as any,
      businessOperationsFactory: {} as any,
      releasesFactory: {} as any,
    };

    /**
     * Mock SamlService
     */
    mockSamlService = {
      generateAuthnRequest: jest.fn(),
      validateAndParseResponse: jest.fn(),
    } as any;

    (SamlService as jest.Mock).mockImplementation(() => mockSamlService);

    /**
     * Create controller
     */
    controller = new SamlController(mockFactories);

    /**
     * Mock Express Request
     */
    mockReq = {
      params: {},
      query: {},
      body: {},
    };

    /**
     * Mock Express Response
     */
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    /**
     * Clean up environment
     */
    Reflect.deleteProperty(process.env, 'API_URL');
    Reflect.deleteProperty(process.env, 'GARAGE_URL');
    Reflect.deleteProperty(process.env, 'SSO_SP_ENTITY_ID');
  });

  describe('initiateLogin', () => {
    const testReturnUrl = '/workspace/test';

    beforeEach(() => {
      mockReq.params = { workspaceId: testWorkspaceId };
      mockReq.query = { returnUrl: testReturnUrl };
    });

    it('should redirect to IdP with SAMLRequest and RelayState when SSO is enabled', async () => {
      const workspace = createMockWorkspace();
      mockWorkspacesFactory.findById.mockResolvedValue(workspace);

      const mockRequestId = '_test-request-id-12345';
      const mockEncodedRequest = 'encoded-saml-request';
      mockSamlService.generateAuthnRequest.mockResolvedValue({
        requestId: mockRequestId,
        encodedRequest: mockEncodedRequest,
      });

      await controller.initiateLogin(mockReq as Request, mockRes as Response);

      /**
       * Verify workspace was fetched
       */
      expect(mockWorkspacesFactory.findById).toHaveBeenCalledWith(testWorkspaceId);

      /**
       * Verify AuthnRequest was generated
       */
      expect(mockSamlService.generateAuthnRequest).toHaveBeenCalledWith(
        testWorkspaceId,
        expect.stringContaining(`/auth/sso/saml/${testWorkspaceId}/acs`),
        expect.any(String),
        testSamlConfig
      );

      /**
       * Verify redirect to IdP with SAMLRequest and RelayState
       */
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://idp.example.com/sso') // got from testSamlConfig.ssoUrl
      );

      const redirectUrl = new URL((mockRes.redirect as jest.Mock).mock.calls[0][0]);
      expect(redirectUrl.searchParams.get('SAMLRequest')).toBe(mockEncodedRequest);
      expect(redirectUrl.searchParams.get('RelayState')).toBeTruthy();

      /**
       * Verify AuthnRequest ID was saved by checking it can be validated
       */
      expect(samlStore.validateAndConsumeAuthnRequest(mockRequestId, testWorkspaceId)).toBe(true);
    });

    it('should use default returnUrl when not provided', async () => {
      const workspace = createMockWorkspace();
      mockWorkspacesFactory.findById.mockResolvedValue(workspace);
      mockReq.query = {};

      const mockRequestId = '_test-request-id-12345';
      mockSamlService.generateAuthnRequest.mockResolvedValue({
        requestId: mockRequestId,
        encodedRequest: 'encoded-saml-request',
      });

      await controller.initiateLogin(mockReq as Request, mockRes as Response);

      /**
       * Verify redirect contains RelayState
       */
      const redirectCall = (mockRes.redirect as jest.Mock).mock.calls[0][0];
      const redirectUrl = new URL(redirectCall);
      const relayStateId = redirectUrl.searchParams.get('RelayState');
      expect(relayStateId).toBeTruthy();

      /**
       * Verify that default returnUrl was saved in RelayState
       * Default returnUrl is `/workspace/${workspaceId}`
       */
      const relayState = samlStore.getRelayState(relayStateId!);
      expect(relayState).not.toBeNull();
      expect(relayState?.returnUrl).toBe(`/workspace/${testWorkspaceId}`);
      expect(relayState?.workspaceId).toBe(testWorkspaceId);
    });

    it('should return 400 error when workspace is not found', async () => {
      mockWorkspacesFactory.findById.mockResolvedValue(null);

      await controller.initiateLogin(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should return 400 error when workspace exists but SSO is not configured', async () => {
      const workspace = createMockWorkspace({ sso: undefined });
      mockWorkspacesFactory.findById.mockResolvedValue(workspace);

      await controller.initiateLogin(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'SSO is not enabled for this workspace',
      });
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should return 400 error when SSO is disabled', async () => {
      const workspace = createMockWorkspace({
        sso: {
          enabled: false,
          enforced: false,
          type: 'saml',
          saml: testSamlConfig,
        },
      });
      mockWorkspacesFactory.findById.mockResolvedValue(workspace);

      await controller.initiateLogin(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'SSO is not enabled for this workspace',
      });
    });
  });

  describe('handleAcs', () => {
    const testSamlResponse = 'base64-encoded-saml-response';
    const testRelayStateId = 'test-relay-state-id';
    const testNameId = 'user@idp.example.com';
    const testEmail = 'user@example.com';
    const testRequestId = '_test-request-id-12345';

    const mockSamlResponseData = {
      nameId: testNameId,
      email: testEmail,
      name: 'Test User',
      inResponseTo: testRequestId,
    };

    beforeEach(() => {
      mockReq.params = { workspaceId: testWorkspaceId };
      mockReq.body = {
        SAMLResponse: testSamlResponse,
        RelayState: testRelayStateId,
      };
    });

    it('should process SAML response and redirect to frontend with tokens', async () => {
      const workspace = createMockWorkspace();
      const user = createMockUser();

      /**
       * Setup test data
       */
      const testReturnUrl = '/workspace/test';
      const expectedFrontendUrl = `${process.env.GARAGE_URL}${testReturnUrl}`;

      mockWorkspacesFactory.findById.mockResolvedValue(workspace);
      mockUsersFactory.findBySamlIdentity.mockResolvedValue(user);
      mockSamlService.validateAndParseResponse.mockResolvedValue(mockSamlResponseData);

      /**
       * Setup samlStore to return valid state for tests
       */
      samlStore.saveRelayState(testRelayStateId, {
        returnUrl: testReturnUrl,
        workspaceId: testWorkspaceId,
      });
      samlStore.saveAuthnRequest(testRequestId, testWorkspaceId);

      await controller.handleAcs(mockReq as Request, mockRes as Response);

      /**
       * Verify workspace was fetched
       */
      expect(mockWorkspacesFactory.findById).toHaveBeenCalledWith(testWorkspaceId);

      /**
       * Verify SAML response was validated
       */
      expect(mockSamlService.validateAndParseResponse).toHaveBeenCalledWith(
        testSamlResponse,
        testWorkspaceId,
        expect.stringContaining(`/auth/sso/saml/${testWorkspaceId}/acs`),
        testSamlConfig
      );

      /**
       * Verify InResponseTo validation was performed
       * (samlStore is singleton, validation happens internally)
       */

      /**
       * Verify user lookup
       */
      expect(mockUsersFactory.findBySamlIdentity).toHaveBeenCalledWith(
        testWorkspaceId,
        testNameId
      );

      /**
       * Verify tokens were generated
       */
      expect(user.generateTokensPair).toHaveBeenCalled();

      /**
       * Verify redirect to frontend with returnUrl from RelayState
       * GARAGE_URL is set in beforeEach: 'https://garage.example.com'
       */
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining(expectedFrontendUrl)
      );

      const redirectUrl = new URL((mockRes.redirect as jest.Mock).mock.calls[0][0]);
      expect(redirectUrl.searchParams.get('access_token')).toBe('test-access-token');
      expect(redirectUrl.searchParams.get('refresh_token')).toBe('test-refresh-token');
    });

    it('should return 400 error when workspace is not found', async () => {
      mockWorkspacesFactory.findById.mockResolvedValue(null);

      await controller.handleAcs(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'SSO is not enabled for this workspace',
      });
    });

    it('should return 400 error when SSO is not enabled', async () => {
      const workspace = createMockWorkspace({ sso: undefined });
      mockWorkspacesFactory.findById.mockResolvedValue(workspace);

      await controller.handleAcs(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'SSO is not enabled for this workspace',
      });
    });

    it('should return 400 error when SAML validation fails', async () => {
      const workspace = createMockWorkspace();
      mockWorkspacesFactory.findById.mockResolvedValue(workspace);
      mockSamlService.validateAndParseResponse.mockRejectedValue(
        new Error('Invalid signature')
      );

      await controller.handleAcs(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid SAML response',
      });
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should return 400 error when InResponseTo validation fails', async () => {
      const workspace = createMockWorkspace();
      mockWorkspacesFactory.findById.mockResolvedValue(workspace);
      mockSamlService.validateAndParseResponse.mockResolvedValue(mockSamlResponseData);

      /**
       * Don't save AuthnRequest, so validation will fail
       */

      await controller.handleAcs(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid SAML response: InResponseTo validation failed',
      });
    });

    it('should create user with JIT provisioning when user not found', async () => {
      const workspace = createMockWorkspace();
      const newUser = createMockUser({ email: testEmail });

      mockWorkspacesFactory.findById.mockResolvedValue(workspace);
      mockUsersFactory.findBySamlIdentity.mockResolvedValue(null);
      mockUsersFactory.findByEmail.mockResolvedValue(null);
      mockUsersFactory.create.mockResolvedValue(newUser);
      mockSamlService.validateAndParseResponse.mockResolvedValue(mockSamlResponseData);

      /**
       * Setup samlStore with valid state
       */
      samlStore.saveRelayState(testRelayStateId, {
        returnUrl: '/workspace/test',
        workspaceId: testWorkspaceId,
      });
      samlStore.saveAuthnRequest(testRequestId, testWorkspaceId);
      (workspace.getMemberInfo as jest.Mock).mockResolvedValue(null);

      await controller.handleAcs(mockReq as Request, mockRes as Response);

      /**
       * Verify user was created
       */
      expect(mockUsersFactory.create).toHaveBeenCalledWith(testEmail, undefined, undefined);

      /**
       * Verify SAML identity was linked
       */
      expect(newUser.linkSamlIdentity).toHaveBeenCalledWith(
        testWorkspaceId,
        testNameId,
        testEmail
      );

      /**
       * Verify user was added to workspace
       */
      expect(workspace.addMember).toHaveBeenCalledWith(newUser._id.toString());
      expect(newUser.addWorkspace).toHaveBeenCalledWith(testWorkspaceId);

      expect(mockRes.redirect).toHaveBeenCalled();
    });

    it('should link existing user when found by email', async () => {
      const workspace = createMockWorkspace();
      const existingUser = createMockUser({ email: testEmail });

      mockWorkspacesFactory.findById.mockResolvedValue(workspace);
      mockUsersFactory.findBySamlIdentity.mockResolvedValue(null);
      mockUsersFactory.findByEmail.mockResolvedValue(existingUser);
      mockSamlService.validateAndParseResponse.mockResolvedValue(mockSamlResponseData);

      /**
       * Setup samlStore with valid state
       */
      samlStore.saveRelayState(testRelayStateId, {
        returnUrl: '/workspace/test',
        workspaceId: testWorkspaceId,
      });
      samlStore.saveAuthnRequest(testRequestId, testWorkspaceId);
      (workspace.getMemberInfo as jest.Mock).mockResolvedValue(null);

      await controller.handleAcs(mockReq as Request, mockRes as Response);

      /**
       * Verify user was not created
       */
      expect(mockUsersFactory.create).not.toHaveBeenCalled();

      /**
       * Verify SAML identity was linked to existing user
       */
      expect(existingUser.linkSamlIdentity).toHaveBeenCalledWith(
        testWorkspaceId,
        testNameId,
        testEmail
      );
    });

    it('should confirm pending membership when user is pending', async () => {
      const workspace = createMockWorkspace();
      const user = createMockUser();

      mockWorkspacesFactory.findById.mockResolvedValue(workspace);
      mockUsersFactory.findBySamlIdentity.mockResolvedValue(null);
      mockUsersFactory.findByEmail.mockResolvedValue(user);
      mockSamlService.validateAndParseResponse.mockResolvedValue(mockSamlResponseData);

      /**
       * Setup samlStore with valid state
       */
      samlStore.saveRelayState(testRelayStateId, {
        returnUrl: '/workspace/test',
        workspaceId: testWorkspaceId,
      });
      samlStore.saveAuthnRequest(testRequestId, testWorkspaceId);
      (workspace.getMemberInfo as jest.Mock).mockResolvedValue({
        userEmail: testEmail,
      });

      /**
       * Mock isPendingMember static method
       */
      const isPendingMemberSpy = jest.spyOn(WorkspaceModel, 'isPendingMember').mockReturnValue(true);

      await controller.handleAcs(mockReq as Request, mockRes as Response);

      /**
       * Restore mock after test
       */
      isPendingMemberSpy.mockRestore();

      /**
       * Verify pending membership was confirmed
       */
      expect(workspace.confirmMembership).toHaveBeenCalledWith(user);
      expect(user.confirmMembership).toHaveBeenCalledWith(testWorkspaceId);
    });

    it('should use default returnUrl when RelayState is not found', async () => {
      const workspace = createMockWorkspace();
      const user = createMockUser();

      mockWorkspacesFactory.findById.mockResolvedValue(workspace);
      mockUsersFactory.findBySamlIdentity.mockResolvedValue(user);
      mockSamlService.validateAndParseResponse.mockResolvedValue(mockSamlResponseData);

      /**
       * Setup samlStore with AuthnRequest but no RelayState
       */
      samlStore.saveAuthnRequest(testRequestId, testWorkspaceId);

      await controller.handleAcs(mockReq as Request, mockRes as Response);

      /**
       * Verify redirect uses default returnUrl
       */
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining(`/workspace/${testWorkspaceId}`)
      );
    });
  });
});

