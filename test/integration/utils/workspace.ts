import { MongoClient, ObjectId } from 'mongodb';
import type { WorkspaceDBScheme, UserDBScheme } from '@hawk.so/types';
import argon2 from 'argon2';

/**
 * Polyfill for performance API (required by MongoDB driver)
 */
if (typeof global.performance === 'undefined') {
  const { performance } = require('perf_hooks');

  global.performance = performance as any;
}

/**
 * Get MongoDB connection for tests
 * Uses the same database as API (from MONGO_HAWK_DB_URL) to ensure data consistency
 */
export async function getMongoConnection(): Promise<MongoClient> {
  const mongoUrl = process.env.MONGO_HAWK_DB_URL || 'mongodb://mongodb:27017/hawk';
  const client = new MongoClient(mongoUrl);

  await client.connect();

  return client;
}

/**
 * Create test workspace with SSO configuration
 *
 * @param config - Workspace configuration
 * @returns Created workspace ID
 */
export async function createTestWorkspace(config: {
  name?: string;
  sso?: WorkspaceDBScheme['sso'];
  members?: string[];
}): Promise<string> {
  const client = await getMongoConnection();
  const db = client.db();
  const workspacesCollection = db.collection<WorkspaceDBScheme>('workspaces');

  /**
   * Create minimal workspace data for tests
   * Only required fields + SSO config
   */
  const workspaceData: any = {
    name: config.name || 'Test Workspace',
    inviteHash: new ObjectId().toString(),
  };

  /**
   * Add SSO config if provided
   */
  if (config.sso) {
    workspaceData.sso = config.sso;
  }

  const result = await workspacesCollection.insertOne(workspaceData as WorkspaceDBScheme);

  await client.close();

  return result.insertedId.toString();
}

/**
 * Create test user
 *
 * @param config - User configuration
 * @returns Created user ID
 */
export async function createTestUser(config: {
  email: string;
  password?: string;
  name?: string;
  workspaces?: string[];
}): Promise<string> {
  const client = await getMongoConnection();
  const db = client.db();
  const usersCollection = db.collection<UserDBScheme>('users');

  /**
   * Hash password if provided
   */
  const hashedPassword = config.password ? await argon2.hash(config.password) : undefined;

  /**
   * Build workspaces membership object
   * Format: { [workspaceId]: { isPending: false } }
   */
  const workspaces: Record<string, { isPending?: boolean }> = {};

  if (config.workspaces && config.workspaces.length > 0) {
    for (const workspaceId of config.workspaces) {
      workspaces[workspaceId] = { isPending: false };
    }
  }

  const userData: Partial<UserDBScheme> = {
    email: config.email,
    password: hashedPassword,
    name: config.name || config.email,
    workspaces: Object.keys(workspaces).length > 0 ? workspaces : undefined,
    notifications: {
      channels: {
        email: {
          endpoint: config.email,
          isEnabled: true,
          minPeriod: 0,
        },
      },
      whatToReceive: {
        IssueAssigning: true,
        WeeklyDigest: true,
        SystemMessages: true,
      },
    },
  };

  const result = await usersCollection.insertOne(userData as UserDBScheme);
  const userId = result.insertedId;

  /**
   * Add user to workspace teams if workspaces specified
   */
  if (config.workspaces && config.workspaces.length > 0) {
    for (const workspaceId of config.workspaces) {
      const teamCollection = db.collection(`team:${workspaceId}`);

      await teamCollection.insertOne({
        userId,
        isConfirmed: true,
      });
    }
  }

  await client.close();

  return userId.toString();
}

/**
 * Get workspace by ID
 *
 * @param workspaceId - Workspace ID
 * @returns Workspace data or null
 */
export async function getWorkspace(workspaceId: string): Promise<WorkspaceDBScheme | null> {
  const client = await getMongoConnection();
  const db = client.db();
  const workspacesCollection = db.collection<WorkspaceDBScheme>('workspaces');

  const workspace = await workspacesCollection.findOne({ _id: new ObjectId(workspaceId) });

  await client.close();

  return workspace;
}

/**
 * Get user by email
 *
 * @param email - User email
 * @returns User data or null
 */
export async function getUserByEmail(email: string): Promise<UserDBScheme | null> {
  const client = await getMongoConnection();
  const db = client.db();
  const usersCollection = db.collection<UserDBScheme>('users');

  const user = await usersCollection.findOne({ email });

  await client.close();

  return user;
}

/**
 * Clean up test workspace
 *
 * @param workspaceId - Workspace ID to delete
 */
export async function cleanupWorkspace(workspaceId: string): Promise<void> {
  const client = await getMongoConnection();
  const db = client.db();
  const workspacesCollection = db.collection<WorkspaceDBScheme>('workspaces');

  await workspacesCollection.deleteOne({ _id: new ObjectId(workspaceId) });

  await client.close();
}

/**
 * Clean up test user
 *
 * @param email - User email to delete
 */
export async function cleanupUser(email: string): Promise<void> {
  const client = await getMongoConnection();
  const db = client.db();
  const usersCollection = db.collection<UserDBScheme>('users');

  await usersCollection.deleteOne({ email });

  await client.close();
}
