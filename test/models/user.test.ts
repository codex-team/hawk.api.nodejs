import '../../src/env-test';
import UserModel from '../../src/models/user';
import UsersFactory from '../../src/models/usersFactory';
import * as mongo from '../../src/mongo';
import DataLoaders from '../../src/dataLoaders';
import { generateTestString } from '../utils/testData';

beforeAll(async () => {
  await mongo.setupConnections();
});

describe('UserModel SSO identities', () => {
  let usersFactory: UsersFactory;
  let testUser: UserModel;

  beforeEach(async () => {
    /**
     * Create factory instance with fresh DataLoaders
     */
    usersFactory = new UsersFactory(
      mongo.databases.hawk as any,
      new DataLoaders(mongo.databases.hawk as any)
    );
  });

  afterEach(async () => {
    if (testUser?.email) {
      await usersFactory.deleteByEmail(testUser.email);
    }
  });

  describe('linkSamlIdentity', () => {
    it('should link SAML identity to user and update local state', async () => {
      const testWorkspaceId = '507f1f77bcf86cd799439011';
      const testSamlId = generateTestString('model-link');
      const testEmail = generateTestString('model-test-sso@example.com');

      testUser = await usersFactory.create(testEmail, 'test-password-123');
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
      const testWorkspaceId = '507f1f77bcf86cd799439011';
      const testSamlId = generateTestString('model-persist');
      const testEmail = generateTestString('model-test-sso@example.com');

      testUser = await usersFactory.create(testEmail, 'test-password-123');
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

    it('should update existing SAML identity for the same workspace', async () => {
      const testWorkspaceId = '507f1f77bcf86cd799439011';
      const testEmail = generateTestString('model-test-sso@example.com');
      testUser = await usersFactory.create(testEmail, 'test-password-123');

      /**
       * Use unique SAML IDs for this test
       */
      const initialSamlId = generateTestString('initial-identity');
      const newSamlId = generateTestString('updated-identity');
      const newEmail = 'updated-email@example.com';

      /**
       * Link initial identity
       */
      await testUser.linkSamlIdentity(testWorkspaceId, initialSamlId, testEmail);

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
    it('should return null when identity does not exist', async () => {
      const testWorkspaceId = '507f1f77bcf86cd799439011';
      const testEmail = generateTestString('model-test-sso@example.com');
      testUser = await usersFactory.create(testEmail, 'test-password-123');
      /**
       * User without any identities
       */
      const identity = testUser.getSamlIdentity(testWorkspaceId);
      expect(identity).toBeNull();
    });

    it('should return SAML identity when it exists', async () => {
      const testWorkspaceId = '507f1f77bcf86cd799439011';
      const testSamlId = generateTestString('model-get');
      const testEmail = generateTestString('model-test-sso@example.com');

      testUser = await usersFactory.create(testEmail, 'test-password-123');
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
  });

});

afterAll(async done => {
  await mongo.mongoClients.hawk?.close();
  await mongo.mongoClients.events?.close();

  done();
});

