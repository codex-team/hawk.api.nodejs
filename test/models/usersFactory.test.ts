import '../../src/env-test';
import UserModel from '../../src/models/user';
import UsersFactory from '../../src/models/usersFactory';
import * as mongo from '../../src/mongo';
import DataLoaders from '../../src/dataLoaders';

beforeAll(async () => {
  await mongo.setupConnections();
});

describe('UsersFactory SSO identities', () => {
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

  describe('findBySamlIdentity', () => {
    it('should return null when user with SAML identity does not exist', async () => {
      /**
       * Try to find user with non-existent SAML identity
       */
      const foundUser = await usersFactory.findBySamlIdentity(
        testWorkspaceId,
        'non-existent-saml-id'
      );

      expect(foundUser).toBeNull();
    });

    it('should find user by SAML identity', async () => {
      /**
       * Link SAML identity to test user
       */
      await testUser.linkSamlIdentity(testWorkspaceId, testSamlId, testEmail);

      /**
       * Find user by SAML identity using factory method
       */
      const foundUser = await usersFactory.findBySamlIdentity(
        testWorkspaceId,
        testSamlId
      );

      expect(foundUser).not.toBeNull();
      expect(foundUser!._id.toString()).toBe(testUser._id.toString());
      expect(foundUser!.email).toBe(testEmail);
      expect(foundUser!.identities![testWorkspaceId].saml).toEqual({
        id: testSamlId,
        email: testEmail,
      });
    });

    it('should return null for different workspace even if SAML ID matches', async () => {
      const workspaceId2 = '507f1f77bcf86cd799439012';

      /**
       * Link identity for first workspace
       */
      await testUser.linkSamlIdentity(testWorkspaceId, testSamlId, testEmail);

      /**
       * Try to find user by same SAML ID but different workspace
       */
      const foundUser = await usersFactory.findBySamlIdentity(
        workspaceId2,
        testSamlId
      );

      expect(foundUser).toBeNull();
    });
  });
});

afterAll(async done => {
  await mongo.mongoClients.hawk?.close();
  await mongo.mongoClients.events?.close();

  done();
});

