import '../../../src/env-test';
import SamlService from '../../../src/sso/saml/service';
import { SamlConfig } from '../../../src/sso/types';
import { SamlValidationError, SamlValidationErrorType } from '../../../src/sso/saml/types';
import * as nodeSaml from '@node-saml/node-saml';

/**
 * Mock @node-saml/node-saml
 */
jest.mock('@node-saml/node-saml');

describe('SamlService', () => {
  let samlService: SamlService;
  const testWorkspaceId = '507f1f77bcf86cd799439011';
  const testAcsUrl = 'https://api.example.com/auth/sso/saml/507f1f77bcf86cd799439011/acs';

  /**
   * Test SAML configuration
   */
  const testSamlConfig: SamlConfig = {
    idpEntityId: 'urn:test:idp',
    ssoUrl: 'https://idp.example.com/sso',
    x509Cert: '-----BEGIN CERTIFICATE-----\nTEST_CERTIFICATE\n-----END CERTIFICATE-----',
    nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attributeMapping: {
      email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    },
  };

  const mockSamlInstance = {
    validatePostResponseAsync: jest.fn(),
    getAuthorizeMessageAsync: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (nodeSaml.SAML as jest.Mock).mockImplementation(() => mockSamlInstance);
    process.env.SSO_SP_ENTITY_ID = 'urn:hawk:tracker:saml';
    samlService = new SamlService();
  });

  afterEach(() => {
    /**
     * Restore env
     */
    Reflect.deleteProperty(process.env, 'SSO_SP_ENTITY_ID');
  });

  describe('generateAuthnRequest', () => {
    const testRelayState = 'test-relay-state-123';

    /**
     * Helper to create a mock SAML AuthnRequest (deflated + base64 encoded)
     */
    function createMockEncodedRequest(requestId: string): string {
      const zlib = require('zlib');
      const xml = `<?xml version="1.0"?>
        <samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
          ID="${requestId}"
          Version="2.0"
          IssueInstant="2025-01-01T00:00:00Z"
          Destination="https://idp.example.com/sso"
          AssertionConsumerServiceURL="https://api.example.com/auth/sso/saml/507f1f77bcf86cd799439011/acs">
          <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">urn:hawk:tracker:saml</saml:Issuer>
        </samlp:AuthnRequest>`;

      const deflated = zlib.deflateRawSync(xml);

      return deflated.toString('base64');
    }

    it('should generate AuthnRequest and return request ID', async () => {
      const mockRequestId = '_test-request-id-12345';
      const mockEncodedRequest = createMockEncodedRequest(mockRequestId);

      mockSamlInstance.getAuthorizeMessageAsync.mockResolvedValue({
        SAMLRequest: mockEncodedRequest,
        RelayState: testRelayState,
      });

      const result = await samlService.generateAuthnRequest(
        testWorkspaceId,
        testAcsUrl,
        testRelayState,
        testSamlConfig
      );

      expect(result.requestId).toBe(mockRequestId);
      expect(result.encodedRequest).toBe(mockEncodedRequest);
    });

    it('should call getAuthorizeMessageAsync with correct relay state', async () => {
      const mockRequestId = '_another-request-id';
      const mockEncodedRequest = createMockEncodedRequest(mockRequestId);

      mockSamlInstance.getAuthorizeMessageAsync.mockResolvedValue({
        SAMLRequest: mockEncodedRequest,
      });

      await samlService.generateAuthnRequest(
        testWorkspaceId,
        testAcsUrl,
        testRelayState,
        testSamlConfig
      );

      expect(mockSamlInstance.getAuthorizeMessageAsync).toHaveBeenCalledWith(
        testRelayState,
        undefined,
        {}
      );
    });

    it('should throw error when SAMLRequest is not returned', async () => {
      mockSamlInstance.getAuthorizeMessageAsync.mockResolvedValue({
        /**
         * No SAMLRequest in response
         */
      });

      await expect(
        samlService.generateAuthnRequest(
          testWorkspaceId,
          testAcsUrl,
          testRelayState,
          testSamlConfig
        )
      ).rejects.toThrow('Failed to generate SAML AuthnRequest');
    });

    it('should throw error when request ID cannot be extracted', async () => {
      const zlib = require('zlib');
      /**
       * Invalid XML without ID attribute
       */
      const invalidXml = '<invalid>no id here</invalid>';
      const deflated = zlib.deflateRawSync(invalidXml);
      const invalidEncodedRequest = deflated.toString('base64');

      mockSamlInstance.getAuthorizeMessageAsync.mockResolvedValue({
        SAMLRequest: invalidEncodedRequest,
      });

      await expect(
        samlService.generateAuthnRequest(
          testWorkspaceId,
          testAcsUrl,
          testRelayState,
          testSamlConfig
        )
      ).rejects.toThrow('Failed to extract request ID from AuthnRequest');
    });
  });

  describe('validateAndParseResponse', () => {
    const testSamlResponse = 'base64EncodedSamlResponse';

    it('should parse valid SAML Response and extract user data', async () => {
      /**
       * Mock successful SAML validation with all required attributes
       */
      mockSamlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: {
          nameID: 'user-name-id-123',
          inResponseTo: '_request-id-123',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'user@example.com',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'John Doe',
        },
      });

      const result = await samlService.validateAndParseResponse(
        testSamlResponse,
        testWorkspaceId,
        testAcsUrl,
        testSamlConfig
      );

      expect(result).toEqual({
        nameId: 'user-name-id-123',
        email: 'user@example.com',
        name: 'John Doe',
        inResponseTo: '_request-id-123',
      });
    });

    it('should work without optional name attribute', async () => {
      mockSamlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: {
          nameID: 'user-name-id-123',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'user@example.com',
          /**
           * name attribute is not provided by IdP
           */
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': undefined,
        },
      });

      const result = await samlService.validateAndParseResponse(
        testSamlResponse,
        testWorkspaceId,
        testAcsUrl,
        testSamlConfig
      );

      expect(result.nameId).toBe('user-name-id-123');
      expect(result.email).toBe('user@example.com');
      expect(result.name).toBeUndefined();
    });

    it('should throw INVALID_SIGNATURE error when signature validation fails', async () => {
      mockSamlInstance.validatePostResponseAsync.mockRejectedValue(
        new Error('Invalid signature')
      );

      await expect(
        samlService.validateAndParseResponse(
          testSamlResponse,
          testWorkspaceId,
          testAcsUrl,
          testSamlConfig
        )
      ).rejects.toThrow(SamlValidationError);

      try {
        await samlService.validateAndParseResponse(
          testSamlResponse,
          testWorkspaceId,
          testAcsUrl,
          testSamlConfig
        );
      } catch (error) {
        expect(error).toBeInstanceOf(SamlValidationError);
        expect((error as SamlValidationError).type).toBe(SamlValidationErrorType.INVALID_SIGNATURE);
      }
    });

    it('should throw EXPIRED_ASSERTION error when assertion is expired', async () => {
      mockSamlInstance.validatePostResponseAsync.mockRejectedValue(
        new Error('SAML assertion NotOnOrAfter condition not met')
      );

      const promise = samlService.validateAndParseResponse(
        testSamlResponse,
        testWorkspaceId,
        testAcsUrl,
        testSamlConfig
      );

      await expect(promise).rejects.toThrow(SamlValidationError);
      await expect(promise).rejects.toMatchObject({
        type: SamlValidationErrorType.EXPIRED_ASSERTION,
      });
    });

    it('should throw INVALID_AUDIENCE error when audience validation fails', async () => {
      mockSamlInstance.validatePostResponseAsync.mockRejectedValue(
        new Error('SAML Audience not valid')
      );

      const promise = samlService.validateAndParseResponse(
        testSamlResponse,
        testWorkspaceId,
        testAcsUrl,
        testSamlConfig
      );

      await expect(promise).rejects.toThrow(SamlValidationError);
      await expect(promise).rejects.toMatchObject({
        type: SamlValidationErrorType.INVALID_AUDIENCE,
      });
    });

    it('should throw INVALID_NAME_ID error when NameID is missing', async () => {
      mockSamlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: {
          /**
           * No nameID in profile
           */
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'user@example.com',
        },
      });

      const promise = samlService.validateAndParseResponse(
        testSamlResponse,
        testWorkspaceId,
        testAcsUrl,
        testSamlConfig
      );

      await expect(promise).rejects.toThrow(SamlValidationError);
      await expect(promise).rejects.toMatchObject({
        type: SamlValidationErrorType.INVALID_NAME_ID,
      });
    });

    it('should throw MISSING_EMAIL error when email attribute is not found', async () => {
      mockSamlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: {
          nameID: 'user-name-id-123',
          /**
           * Wrong attribute name, email attribute is missing
           */
          'wrong-attribute': 'user@example.com',
        },
      });

      const promise = samlService.validateAndParseResponse(
        testSamlResponse,
        testWorkspaceId,
        testAcsUrl,
        testSamlConfig
      );

      await expect(promise).rejects.toThrow(SamlValidationError);
      await expect(promise).rejects.toMatchObject({
        type: SamlValidationErrorType.MISSING_EMAIL,
      });
    });

    it('should throw INVALID_IN_RESPONSE_TO when InResponseTo does not match expected request ID', async () => {
      mockSamlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: {
          nameID: 'user-name-id-123',
          inResponseTo: '_different-request-id',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'user@example.com',
        },
      });

      const promise = samlService.validateAndParseResponse(
        testSamlResponse,
        testWorkspaceId,
        testAcsUrl,
        testSamlConfig,
        '_expected-request-id'
      );

      await expect(promise).rejects.toThrow(SamlValidationError);
      await expect(promise).rejects.toMatchObject({
        type: SamlValidationErrorType.INVALID_IN_RESPONSE_TO,
        context: {
          expected: '_expected-request-id',
          received: '_different-request-id',
        },
      });
    });

    it('should validate InResponseTo when expectedRequestId is provided', async () => {
      mockSamlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: {
          nameID: 'user-name-id-123',
          inResponseTo: '_expected-request-id',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'user@example.com',
        },
      });

      const result = await samlService.validateAndParseResponse(
        testSamlResponse,
        testWorkspaceId,
        testAcsUrl,
        testSamlConfig,
        '_expected-request-id'
      );

      expect(result.inResponseTo).toBe('_expected-request-id');
    });

    it('should handle email as array attribute', async () => {
      mockSamlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: {
          nameID: 'user-name-id-123',
          /**
           * Some IdPs return attributes as arrays
           */
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': ['user@example.com', 'secondary@example.com'],
        },
      });

      const result = await samlService.validateAndParseResponse(
        testSamlResponse,
        testWorkspaceId,
        testAcsUrl,
        testSamlConfig
      );

      /**
       * Should use first email from array
       */
      expect(result.email).toBe('user@example.com');
    });
  });
});
