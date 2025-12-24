import '../../src/env-test';
import UsersFactory from '../../src/models/usersFactory';
import * as mongo from '../../src/mongo';
import DataLoaders from '../../src/dataLoaders';
import { generateTestString } from '../utils/testData';

beforeAll(async () => {
  await mongo.setupConnections();
});

describe('UsersFactory SSO identities', () => {
  let usersFactory: UsersFactory;
  let emailsToCleanup: string[] = [];

  const createUsersFactory = (): UsersFactory => {
    return new UsersFactory(
      mongo.databases.hawk as any,
      new DataLoaders(mongo.databases.hawk as any)
    );
  };

  beforeEach(() => {
    usersFactory = createUsersFactory();
    emailsToCleanup = [];
  });

  afterEach(async () => {
    /**
     * Cleanup only data created by this test.
     * Do NOT drop/delete whole collections: tests can run in parallel across files.
     */
    const uniqueEmails = Array.from(new Set(emailsToCleanup));

    for (const email of uniqueEmails) {
      try {
        await usersFactory.deleteByEmail(email);
      } catch {
        /**
         * Ignore cleanup errors (e.g. already deleted by the test itself)
         */
      }
    }
  });

  describe('findBySamlIdentity', () => {
    it('should return null when user with SAML identity does not exist', async () => {
      const testWorkspaceId = '507f1f77bcf86cd799439011';
      /**
       * Use unique SAML ID to avoid conflicts with other tests
       */
      const uniqueSamlId = generateTestString('non-existent');

      /**
       * Try to find user with non-existent SAML identity
       */
      const foundUser = await usersFactory.findBySamlIdentity(
        testWorkspaceId,
        uniqueSamlId
      );

      expect(foundUser).toBeNull();
    });

    it('should find user by SAML identity', async () => {
      const testWorkspaceId = '507f1f77bcf86cd799439011';
      const testEmail = generateTestString('factory-test-sso@example.com');
      /**
       * Use unique SAML ID for this specific test
       */
      const uniqueSamlId = generateTestString('find-test');

      /**
       * Create test user for this test
       */
      const testUser = await usersFactory.create(testEmail, 'test-password-123');
      emailsToCleanup.push(testEmail);

      /**
       * Link SAML identity to test user
       */
      await testUser.linkSamlIdentity(testWorkspaceId, uniqueSamlId, testEmail);

      /**
       * Find user by SAML identity using factory method
       */
      const foundUser = await usersFactory.findBySamlIdentity(
        testWorkspaceId,
        uniqueSamlId
      );

      expect(foundUser).not.toBeNull();
      expect(foundUser!._id.toString()).toBe(testUser._id.toString());
      expect(foundUser!.email).toBe(testEmail);
      expect(foundUser!.identities![testWorkspaceId].saml).toEqual({
        id: uniqueSamlId,
        email: testEmail,
      });
    });

    it('should return null for different workspace even if SAML ID matches', async () => {
      const testWorkspaceId = '507f1f77bcf86cd799439011';
      const workspaceId2 = '507f1f77bcf86cd799439012';
      const testEmail = generateTestString('factory-test-sso@example.com');
      /**
       * Use unique SAML ID for this specific test
       */
      const uniqueSamlId = generateTestString('workspace-test');

      /**
       * Create test user for this test
       */
      const testUser = await usersFactory.create(testEmail, 'test-password-123');
      emailsToCleanup.push(testEmail);

      /**
       * Link identity for first workspace
       */
      await testUser.linkSamlIdentity(testWorkspaceId, uniqueSamlId, testEmail);

      /**
       * Try to find user by same SAML ID but different workspace
       */
      const foundUser = await usersFactory.findBySamlIdentity(
        workspaceId2,
        uniqueSamlId
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

