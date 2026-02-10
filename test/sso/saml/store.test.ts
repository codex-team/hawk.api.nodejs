import '../../../src/env-test';
import { MemorySamlStateStore } from '../../../src/sso/saml/store/memory.store';

describe('SamlStateStore', () => {
  let SamlStateStore: MemorySamlStateStore;

  beforeEach(() => {
    /**
     * Create fresh instance for each test
     */
    SamlStateStore = new MemorySamlStateStore();
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

    it('should save and retrieve RelayState', async () => {
      await SamlStateStore.saveRelayState(testStateId, testData);

      const result = await SamlStateStore.getRelayState(testStateId);

      expect(result).toEqual(testData);
    });

    it('should return null for non-existent RelayState', async () => {
      const result = await SamlStateStore.getRelayState('non-existent-id');

      expect(result).toBeNull();
    });

    it('should consume (delete) RelayState after retrieval (prevent replay)', async () => {
      await SamlStateStore.saveRelayState(testStateId, testData);

      /**
       * First retrieval should return data
       */
      const firstResult = await SamlStateStore.getRelayState(testStateId);

      expect(firstResult).toEqual(testData);

      /**
       * Second retrieval should return null (consumed)
       */
      const secondResult = await SamlStateStore.getRelayState(testStateId);

      expect(secondResult).toBeNull();
    });

    it('should return null for expired RelayState', async () => {
      /**
       * Mock Date.now to simulate expiration
       */
      const originalDateNow = Date.now;
      const startTime = 1000000000000;

      Date.now = jest.fn().mockReturnValue(startTime);
      await SamlStateStore.saveRelayState(testStateId, testData);

      /**
       * Move time forward by 6 minutes (past 5 min TTL)
       */
      Date.now = jest.fn().mockReturnValue(startTime + 6 * 60 * 1000);
      const result = await SamlStateStore.getRelayState(testStateId);

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

    it('should save and validate AuthnRequest', async () => {
      await SamlStateStore.saveAuthnRequest(testRequestId, testWorkspaceId);

      const result = await SamlStateStore.validateAndConsumeAuthnRequest(
        testRequestId,
        testWorkspaceId
      );

      expect(result).toBe(true);
    });

    it('should return false for non-existent AuthnRequest', async () => {
      const result = await SamlStateStore.validateAndConsumeAuthnRequest(
        'non-existent-request',
        testWorkspaceId
      );

      expect(result).toBe(false);
    });

    it('should return false for wrong workspace ID', async () => {
      await SamlStateStore.saveAuthnRequest(testRequestId, testWorkspaceId);

      const result = await SamlStateStore.validateAndConsumeAuthnRequest(
        testRequestId,
        'different-workspace-id'
      );

      expect(result).toBe(false);
    });

    it('should consume (delete) AuthnRequest after validation (prevent replay)', async () => {
      await SamlStateStore.saveAuthnRequest(testRequestId, testWorkspaceId);

      /**
       * First validation should succeed
       */
      const firstResult = await SamlStateStore.validateAndConsumeAuthnRequest(
        testRequestId,
        testWorkspaceId
      );

      expect(firstResult).toBe(true);

      /**
       * Second validation should fail (consumed)
       */
      const secondResult = await SamlStateStore.validateAndConsumeAuthnRequest(
        testRequestId,
        testWorkspaceId
      );

      expect(secondResult).toBe(false);
    });

    it('should return false for expired AuthnRequest', async () => {
      const originalDateNow = Date.now;
      const startTime = 1000000000000;

      Date.now = jest.fn().mockReturnValue(startTime);
      await SamlStateStore.saveAuthnRequest(testRequestId, testWorkspaceId);

      /**
       * Move time forward by 6 minutes (past 5 min TTL)
       */
      Date.now = jest.fn().mockReturnValue(startTime + 6 * 60 * 1000);
      const result = await SamlStateStore.validateAndConsumeAuthnRequest(
        testRequestId,
        testWorkspaceId
      );

      expect(result).toBe(false);

      Date.now = originalDateNow;
    });
  });

  describe('clear', () => {
    it('should clear all stored state', async () => {
      await SamlStateStore.saveRelayState('state-1', {
        returnUrl: '/test',
        workspaceId: 'ws-1',
      });
      await SamlStateStore.saveAuthnRequest('request-1', 'ws-1');

      SamlStateStore.clear();

      expect(await SamlStateStore.getRelayState('state-1')).toBeNull();
      expect(await SamlStateStore.validateAndConsumeAuthnRequest('request-1', 'ws-1')).toBe(false);
    });
  });
});
