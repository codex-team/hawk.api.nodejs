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

    it('should find correct user when multiple users have SAML identities', async () => {
      /**
       * Create second user with different SAML identity
       */
      const user2Email = 'test-sso-2@example.com';
      const user2SamlId = 'test-saml-name-id-456';
      const user2 = await usersFactory.create(user2Email, 'test-password-456');

      try {
        /**
         * Link identities for both users
         */
        await testUser.linkSamlIdentity(testWorkspaceId, testSamlId, testEmail);
        await user2.linkSamlIdentity(testWorkspaceId, user2SamlId, user2Email);

        /**
         * Find first user by its SAML identity
         */
        const foundUser1 = await usersFactory.findBySamlIdentity(
          testWorkspaceId,
          testSamlId
        );

        expect(foundUser1).not.toBeNull();
        expect(foundUser1!._id.toString()).toBe(testUser._id.toString());
        expect(foundUser1!.email).toBe(testEmail);

        /**
         * Find second user by its SAML identity
         */
        const foundUser2 = await usersFactory.findBySamlIdentity(
          testWorkspaceId,
          user2SamlId
        );

        expect(foundUser2).not.toBeNull();
        expect(foundUser2!._id.toString()).toBe(user2._id.toString());
        expect(foundUser2!.email).toBe(user2Email);
      } finally {
        /**
         * Clean up second user
         */
        if (user2 && user2.email) {
          await usersFactory.deleteByEmail(user2.email);
        }
      }
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

