import '../../src/env-test';
import UserModel from '../../src/models/user';
import UsersFactory from '../../src/models/usersFactory';
import * as mongo from '../../src/mongo';
import DataLoaders from '../../src/dataLoaders';

beforeAll(async () => {
  await mongo.setupConnections();
});

describe('UserModel SSO identities', () => {
  let usersFactory: UsersFactory;
  let testUser: UserModel;
  const testWorkspaceId = '507f1f77bcf86cd799439011';
  const testSamlId = 'test-saml-name-id-123';
  const testEmail = 'test-sso@example.com';

  beforeEach(async () => {
    /**
     * Create factory instance
     */
    usersFactory = new UsersFactory(
      mongo.databases.hawk as any,
      new DataLoaders(mongo.databases.hawk as any)
    );

    /**
     * Create test user
     */
    testUser = await usersFactory.create(testEmail, 'test-password-123');
  });

  afterEach(async () => {
    /**
     * Clean up test user
     */
    if (testUser && testUser.email) {
      await usersFactory.deleteByEmail(testUser.email);
    }
  });

  describe('linkSamlIdentity', () => {
    it('should link SAML identity to user and update local state', async () => {
      /**
       * Initially, user should not have any identities
       */
      expect(testUser.identities).toBeUndefined();

      /**
       * Link SAML identity
       */
      await testUser.linkSamlIdentity(testWorkspaceId, testSamlId, testEmail);

      /**
       * Check that local state is updated
       */
      expect(testUser.identities).toBeDefined();
      expect(testUser.identities![testWorkspaceId]).toBeDefined();
      expect(testUser.identities![testWorkspaceId].saml).toEqual({
        id: testSamlId,
        email: testEmail,
      });
    });

    it('should persist SAML identity in database', async () => {
      /**
       * Link SAML identity
       */
      await testUser.linkSamlIdentity(testWorkspaceId, testSamlId, testEmail);

      /**
       * Reload user from database to verify persistence
       */
      const reloadedUser = await usersFactory.findById(testUser._id.toString());

      expect(reloadedUser).not.toBeNull();
      expect(reloadedUser!.identities).toBeDefined();
      expect(reloadedUser!.identities![testWorkspaceId]).toBeDefined();
      expect(reloadedUser!.identities![testWorkspaceId].saml).toEqual({
        id: testSamlId,
        email: testEmail,
      });
    });

    it('should allow linking identities for multiple workspaces', async () => {
      const workspaceId2 = '507f1f77bcf86cd799439012';
      const samlId2 = 'test-saml-name-id-456';
      const email2 = 'test-sso-2@example.com';

      /**
       * Link identity for first workspace
       */
      await testUser.linkSamlIdentity(testWorkspaceId, testSamlId, testEmail);

      /**
       * Link identity for second workspace
       */
      await testUser.linkSamlIdentity(workspaceId2, samlId2, email2);

      /**
       * Check that both identities are present
       */
      expect(testUser.identities![testWorkspaceId].saml).toEqual({
        id: testSamlId,
        email: testEmail,
      });
      expect(testUser.identities![workspaceId2].saml).toEqual({
        id: samlId2,
        email: email2,
      });

      /**
       * Verify in database
       */
      const reloadedUser = await usersFactory.findById(testUser._id.toString());
      expect(reloadedUser!.identities![testWorkspaceId].saml.id).toBe(testSamlId);
      expect(reloadedUser!.identities![workspaceId2].saml.id).toBe(samlId2);
    });

    it('should update existing SAML identity for the same workspace', async () => {
      const newSamlId = 'updated-saml-name-id-789';
      const newEmail = 'updated-email@example.com';

      /**
       * Link initial identity
       */
      await testUser.linkSamlIdentity(testWorkspaceId, testSamlId, testEmail);

      /**
       * Update identity for the same workspace
       */
      await testUser.linkSamlIdentity(testWorkspaceId, newSamlId, newEmail);

      /**
       * Check that identity is updated (not duplicated)
       */
      expect(testUser.identities![testWorkspaceId].saml).toEqual({
        id: newSamlId,
        email: newEmail,
      });

      /**
       * Verify in database
       */
      const reloadedUser = await usersFactory.findById(testUser._id.toString());
      expect(reloadedUser!.identities![testWorkspaceId].saml).toEqual({
        id: newSamlId,
        email: newEmail,
      });
    });
  });

  describe('getSamlIdentity', () => {
    it('should return null when identity does not exist', () => {
      /**
       * User without any identities
       */
      const identity = testUser.getSamlIdentity(testWorkspaceId);
      expect(identity).toBeNull();
    });

    it('should return null for non-existent workspace', async () => {
      /**
       * Link identity for one workspace
       */
      await testUser.linkSamlIdentity(testWorkspaceId, testSamlId, testEmail);

      /**
       * Try to get identity for different workspace
       */
      const nonExistentWorkspaceId = '507f1f77bcf86cd799439099';
      const identity = testUser.getSamlIdentity(nonExistentWorkspaceId);
      expect(identity).toBeNull();
    });

    it('should return SAML identity when it exists', async () => {
      /**
       * Link SAML identity
       */
      await testUser.linkSamlIdentity(testWorkspaceId, testSamlId, testEmail);

      /**
       * Get identity
       */
      const identity = testUser.getSamlIdentity(testWorkspaceId);

      expect(identity).not.toBeNull();
      expect(identity).toEqual({
        id: testSamlId,
        email: testEmail,
      });
    });

    it('should return correct identity for specific workspace when multiple exist', async () => {
      const workspaceId2 = '507f1f77bcf86cd799439012';
      const samlId2 = 'test-saml-name-id-456';
      const email2 = 'test-sso-2@example.com';

      /**
       * Link identities for two workspaces
       */
      await testUser.linkSamlIdentity(testWorkspaceId, testSamlId, testEmail);
      await testUser.linkSamlIdentity(workspaceId2, samlId2, email2);

      /**
       * Get identity for first workspace
       */
      const identity1 = testUser.getSamlIdentity(testWorkspaceId);
      expect(identity1).toEqual({
        id: testSamlId,
        email: testEmail,
      });

      /**
       * Get identity for second workspace
       */
      const identity2 = testUser.getSamlIdentity(workspaceId2);
      expect(identity2).toEqual({
        id: samlId2,
        email: email2,
      });
    });
  });

});

afterAll(async done => {
  await mongo.mongoClients.hawk?.close();
  await mongo.mongoClients.events?.close();

  done();
});

