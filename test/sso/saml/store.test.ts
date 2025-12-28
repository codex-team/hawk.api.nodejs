import '../../../src/env-test';

/**
 * Import the store class directly to create fresh instances for each test
 */
jest.isolateModules(() => {
  /**
   * We need to test the store module in isolation
   */
});

describe('SamlStateStore', () => {
  let SamlStateStore: typeof import('../../../src/sso/saml/store').default;

  beforeEach(() => {
    /**
     * Clear module cache and reimport to get fresh instance
     */
    jest.resetModules();
    SamlStateStore = require('../../../src/sso/saml/store').default;
    SamlStateStore.clear();
  });

  afterEach(() => {
    SamlStateStore.stopCleanupTimer();
  });

  describe('RelayState', () => {
    const testStateId = 'test-state-id-123';
    const testData = {
      returnUrl: '/workspace/abc123',
      workspaceId: '507f1f77bcf86cd799439011',
    };

    it('should save and retrieve RelayState', () => {
      SamlStateStore.saveRelayState(testStateId, testData);

      const result = SamlStateStore.getRelayState(testStateId);

      expect(result).toEqual(testData);
    });

    it('should return null for non-existent RelayState', () => {
      const result = SamlStateStore.getRelayState('non-existent-id');

      expect(result).toBeNull();
    });

    it('should consume (delete) RelayState after retrieval (prevent replay)', () => {
      SamlStateStore.saveRelayState(testStateId, testData);

      /**
       * First retrieval should return data
       */
      const firstResult = SamlStateStore.getRelayState(testStateId);
      expect(firstResult).toEqual(testData);

      /**
       * Second retrieval should return null (consumed)
       */
      const secondResult = SamlStateStore.getRelayState(testStateId);
      expect(secondResult).toBeNull();
    });

    it('should return null for expired RelayState', () => {
      /**
       * Mock Date.now to simulate expiration
       */
      const originalDateNow = Date.now;
      const startTime = 1000000000000;

      Date.now = jest.fn().mockReturnValue(startTime);
      SamlStateStore.saveRelayState(testStateId, testData);

      /**
       * Move time forward by 6 minutes (past 5 min TTL)
       */
      Date.now = jest.fn().mockReturnValue(startTime + 6 * 60 * 1000);
      const result = SamlStateStore.getRelayState(testStateId);

      expect(result).toBeNull();

      /**
       * Restore Date.now
       */
      Date.now = originalDateNow;
    });
  });

  describe('AuthnRequest', () => {
    const testRequestId = '_request-id-abc123';
    const testWorkspaceId = '507f1f77bcf86cd799439011';

    it('should save and validate AuthnRequest', () => {
      SamlStateStore.saveAuthnRequest(testRequestId, testWorkspaceId);

      const result = SamlStateStore.validateAndConsumeAuthnRequest(
        testRequestId,
        testWorkspaceId
      );

      expect(result).toBe(true);
    });

    it('should return false for non-existent AuthnRequest', () => {
      const result = SamlStateStore.validateAndConsumeAuthnRequest(
        'non-existent-request',
        testWorkspaceId
      );

      expect(result).toBe(false);
    });

    it('should return false for wrong workspace ID', () => {
      SamlStateStore.saveAuthnRequest(testRequestId, testWorkspaceId);

      const result = SamlStateStore.validateAndConsumeAuthnRequest(
        testRequestId,
        'different-workspace-id'
      );

      expect(result).toBe(false);
    });

    it('should consume (delete) AuthnRequest after validation (prevent replay)', () => {
      SamlStateStore.saveAuthnRequest(testRequestId, testWorkspaceId);

      /**
       * First validation should succeed
       */
      const firstResult = SamlStateStore.validateAndConsumeAuthnRequest(
        testRequestId,
        testWorkspaceId
      );
      expect(firstResult).toBe(true);

      /**
       * Second validation should fail (consumed)
       */
      const secondResult = SamlStateStore.validateAndConsumeAuthnRequest(
        testRequestId,
        testWorkspaceId
      );
      expect(secondResult).toBe(false);
    });

    it('should return false for expired AuthnRequest', () => {
      const originalDateNow = Date.now;
      const startTime = 1000000000000;

      Date.now = jest.fn().mockReturnValue(startTime);
      SamlStateStore.saveAuthnRequest(testRequestId, testWorkspaceId);

      /**
       * Move time forward by 6 minutes (past 5 min TTL)
       */
      Date.now = jest.fn().mockReturnValue(startTime + 6 * 60 * 1000);
      const result = SamlStateStore.validateAndConsumeAuthnRequest(
        testRequestId,
        testWorkspaceId
      );

      expect(result).toBe(false);

      Date.now = originalDateNow;
    });
  });

  describe('clear', () => {
    it('should clear all stored state', () => {
      SamlStateStore.saveRelayState('state-1', {
        returnUrl: '/test',
        workspaceId: 'ws-1',
      });
      SamlStateStore.saveAuthnRequest('request-1', 'ws-1');

      SamlStateStore.clear();

      expect(SamlStateStore.getRelayState('state-1')).toBeNull();
      expect(SamlStateStore.validateAndConsumeAuthnRequest('request-1', 'ws-1')).toBe(false);
    });
  });
});

