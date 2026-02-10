import '../../src/env-test';
import { ObjectId } from 'mongodb';
import { ProjectDBScheme, ProjectTaskManagerConfig } from '@hawk.so/types';
import { ResolverContextWithUser } from '../../src/types/graphql';
import { ApolloError, UserInputError } from 'apollo-server-express';

jest.mock('../../src/integrations/github/service', () => require('../__mocks__/github-service'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { deleteInstallationMock, GitHubService } = require('../__mocks__/github-service');

// @ts-expect-error - CommonJS module, TypeScript can't infer types properly
import projectResolverModule from '../../src/resolvers/project';

/**
 * Type assertion for CommonJS module
 */
const projectResolver = projectResolverModule as {
  Mutation: {
    disconnectTaskManager: (...args: unknown[]) => Promise<unknown>;
    updateTaskManagerSettings: (...args: unknown[]) => Promise<unknown>;
  };
  Query: {
    project: (...args: unknown[]) => Promise<unknown>;
  };
};

// Set environment variables for test
process.env.JWT_SECRET_ACCESS_TOKEN = 'belarus';
process.env.JWT_SECRET_REFRESH_TOKEN = 'abacaba';
process.env.JWT_SECRET_PROJECT_TOKEN = 'qwerty';

/**
 * Demo workspace ID (projects in this workspace cannot be updated)
 */
const DEMO_WORKSPACE_ID = '6213b6a01e6281087467cc7a';

/**
 * Creates mock project with optional taskManager configuration
 */
function createMockProject(options: {
  projectId?: string;
  workspaceId?: string;
  taskManager?: ProjectTaskManagerConfig | null;
}): Partial<ProjectDBScheme> & {
  _id: ObjectId;
  workspaceId: ObjectId;
  updateProject: jest.Mock;
  taskManager?: ProjectTaskManagerConfig;
} {
  const {
    projectId = new ObjectId().toString(),
    workspaceId = new ObjectId().toString(),
    taskManager,
  } = options;

  const mockUpdateProject = jest.fn().mockImplementation(async (data) => {
    /**
     * Return updated project with new data
     * Preserve null when explicitly passed (e.g. disconnectTaskManager sets taskManager: null)
     */
    const nextTaskManager = data.taskManager !== undefined
      ? data.taskManager
      : (taskManager ?? undefined);

    return {
      _id: new ObjectId(projectId),
      workspaceId: new ObjectId(workspaceId),
      name: 'Test Project',
      integrationId: 'test-integration-id',
      token: 'test-token',
      notifications: [],
      eventGroupingPatterns: [],
      taskManager: nextTaskManager,
    };
  });

  return {
    _id: new ObjectId(projectId),
    workspaceId: new ObjectId(workspaceId),
    name: 'Test Project',
    integrationId: 'test-integration-id',
    token: 'test-token',
    notifications: [],
    eventGroupingPatterns: [],
    taskManager: taskManager ?? undefined,
    updateProject: mockUpdateProject,
  };
}

/**
 * Creates test context with mocked factories
 */
function createMockContext(mockProject: ReturnType<typeof createMockProject>): ResolverContextWithUser {
  const userId = new ObjectId().toString();

  const mockProjectsFactory = {
    findById: jest.fn().mockResolvedValue(mockProject),
  };

  return {
    user: {
      id: userId,
      accessTokenExpired: false,
    },
    factories: {
      projectsFactory: mockProjectsFactory as any,
      workspacesFactory: {} as any,
      usersFactory: {} as any,
      plansFactory: {} as any,
      businessOperationsFactory: {} as any,
      releasesFactory: {} as any,
    },
  };
}

describe('Project Resolver - Task Manager Mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('disconnectTaskManager', () => {
    const mockTaskManagerConfig: ProjectTaskManagerConfig = {
      type: 'github',
      autoTaskEnabled: true,
      taskThresholdTotalCount: 10,
      assignAgent: false,
      connectedAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      config: {
        installationId: '123456',
        repoId: '789012',
        repoFullName: 'owner/repo',
      },
    };

    it('should disconnect Task Manager successfully', async () => {
      const mockProject = createMockProject({
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      const result = (await projectResolver.Mutation.disconnectTaskManager(
        {},
        { projectId: mockProject._id.toString() },
        context
      )) as { taskManager: ProjectTaskManagerConfig | null };

      expect(context.factories.projectsFactory.findById).toHaveBeenCalledWith(mockProject._id.toString());
      expect(GitHubService).toHaveBeenCalledTimes(1);
      expect(deleteInstallationMock).toHaveBeenCalledWith('123456');
      expect(mockProject.updateProject).toHaveBeenCalledWith({
        taskManager: null,
      });
      expect(result.taskManager).toBeNull();
    });

    it('should throw error if project not found', async () => {
      const mockProject = createMockProject({
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      (context.factories.projectsFactory.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        projectResolver.Mutation.disconnectTaskManager(
          {},
          { projectId: mockProject._id.toString() },
          context
        )
      ).rejects.toThrow(ApolloError);
    });

    it('should throw error for demo project', async () => {
      const mockProject = createMockProject({
        workspaceId: DEMO_WORKSPACE_ID,
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      await expect(
        projectResolver.Mutation.disconnectTaskManager(
          {},
          { projectId: mockProject._id.toString() },
          context
        )
      ).rejects.toThrow('Unable to update demo project');
    });

    it('should handle updateProject errors gracefully', async () => {
      const mockProject = createMockProject({
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      /**
       * Reset mock and configure to reject with an error
       */
      mockProject.updateProject.mockReset();
      mockProject.updateProject.mockRejectedValue(new Error('Database error'));

      try {
        await projectResolver.Mutation.disconnectTaskManager(
          {},
          { projectId: mockProject._id.toString() },
          context
        );
        throw new Error('Expected ApolloError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApolloError);
        expect((error as ApolloError).message).toBe('Failed to disconnect Task Manager');
      }
    });

    it('should work even if taskManager is already null', async () => {
      const mockProject = createMockProject({
        taskManager: null,
      });
      const context = createMockContext(mockProject);

      const result = (await projectResolver.Mutation.disconnectTaskManager(
        {},
        { projectId: mockProject._id.toString() },
        context
      )) as { taskManager: ProjectTaskManagerConfig | null };

      expect(GitHubService).not.toHaveBeenCalled();
      expect(deleteInstallationMock).not.toHaveBeenCalled();
      expect(mockProject.updateProject).toHaveBeenCalledWith({
        taskManager: null,
      });
      expect(result.taskManager).toBeNull();
    });
  });

  describe('updateTaskManagerSettings', () => {
    const mockTaskManagerConfig: ProjectTaskManagerConfig = {
      type: 'github',
      autoTaskEnabled: false,
      taskThresholdTotalCount: 5,
      assignAgent: false,
      connectedAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      config: {
        installationId: '123456',
        repoId: '789012',
        repoFullName: 'owner/repo',
      },
    };

    it('should update Task Manager settings successfully', async () => {
      const mockProject = createMockProject({
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      const input = {
        projectId: mockProject._id.toString(),
        autoTaskEnabled: true,
        taskThresholdTotalCount: 20,
        assignAgent: true,
      };

      const result = (await projectResolver.Mutation.updateTaskManagerSettings(
        {},
        { input },
        context
      )) as { taskManager: ProjectTaskManagerConfig | null };

      expect(context.factories.projectsFactory.findById).toHaveBeenCalledWith(mockProject._id.toString());
      expect(mockProject.updateProject).toHaveBeenCalledWith({
        taskManager: {
          ...mockTaskManagerConfig,
          autoTaskEnabled: true,
          taskThresholdTotalCount: 20,
          assignAgent: true,
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toBeDefined();
    });

    it('should throw error if project not found', async () => {
      const mockProject = createMockProject({
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      (context.factories.projectsFactory.findById as jest.Mock).mockResolvedValue(null);

      const input = {
        projectId: mockProject._id.toString(),
        autoTaskEnabled: true,
        taskThresholdTotalCount: 20,
        assignAgent: true,
      };

      await expect(
        projectResolver.Mutation.updateTaskManagerSettings(
          {},
          { input },
          context
        )
      ).rejects.toThrow(ApolloError);
    });

    it('should throw error for demo project', async () => {
      const mockProject = createMockProject({
        workspaceId: DEMO_WORKSPACE_ID,
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      const input = {
        projectId: mockProject._id.toString(),
        autoTaskEnabled: true,
        taskThresholdTotalCount: 20,
        assignAgent: true,
      };

      await expect(
        projectResolver.Mutation.updateTaskManagerSettings(
          {},
          { input },
          context
        )
      ).rejects.toThrow('Unable to update demo project');
    });

    it('should throw error if taskManager is not configured', async () => {
      const mockProject = createMockProject({
        taskManager: null,
      });
      const context = createMockContext(mockProject);

      const input = {
        projectId: mockProject._id.toString(),
        autoTaskEnabled: true,
        taskThresholdTotalCount: 20,
        assignAgent: true,
      };

      await expect(
        projectResolver.Mutation.updateTaskManagerSettings(
          {},
          { input },
          context
        )
      ).rejects.toThrow(UserInputError);
    });

    it('should throw error if taskThresholdTotalCount is not positive', async () => {
      const mockProject = createMockProject({
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      const input = {
        projectId: mockProject._id.toString(),
        autoTaskEnabled: true,
        taskThresholdTotalCount: 0,
        assignAgent: true,
      };

      await expect(
        projectResolver.Mutation.updateTaskManagerSettings(
          {},
          { input },
          context
        )
      ).rejects.toThrow(UserInputError);
    });

    it('should throw error if taskThresholdTotalCount is negative', async () => {
      const mockProject = createMockProject({
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      const input = {
        projectId: mockProject._id.toString(),
        autoTaskEnabled: true,
        taskThresholdTotalCount: -5,
        assignAgent: true,
      };

      await expect(
        projectResolver.Mutation.updateTaskManagerSettings(
          {},
          { input },
          context
        )
      ).rejects.toThrow(UserInputError);
    });

    it('should throw error if taskThresholdTotalCount is not a number', async () => {
      const mockProject = createMockProject({
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      const input = {
        projectId: mockProject._id.toString(),
        autoTaskEnabled: true,
        taskThresholdTotalCount: 'not-a-number' as any,
        assignAgent: true,
      };

      await expect(
        projectResolver.Mutation.updateTaskManagerSettings(
          {},
          { input },
          context
        )
      ).rejects.toThrow(UserInputError);
    });

    it('should preserve existing taskManager config and usage when updating settings', async () => {
      const mockTaskManagerWithUsage: ProjectTaskManagerConfig = {
        ...mockTaskManagerConfig,
        usage: {
          dayStartUtc: new Date('2025-01-17T00:00:00.000Z'),
          autoTasksCreated: 5,
        },
      };

      const mockProject = createMockProject({
        taskManager: mockTaskManagerWithUsage,
      });
      const context = createMockContext(mockProject);

      const input = {
        projectId: mockProject._id.toString(),
        autoTaskEnabled: true,
        taskThresholdTotalCount: 15,
        assignAgent: true,
      };

      await projectResolver.Mutation.updateTaskManagerSettings(
        {},
        { input },
        context
      );

      expect(mockProject.updateProject).toHaveBeenCalledWith({
        taskManager: {
          ...mockTaskManagerWithUsage,
          autoTaskEnabled: true,
          taskThresholdTotalCount: 15,
          assignAgent: true,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle updateProject errors gracefully', async () => {
      const mockProject = createMockProject({
        taskManager: mockTaskManagerConfig,
      });
      const context = createMockContext(mockProject);

      /**
       * Reset mock and configure to reject with an error
       */
      mockProject.updateProject.mockReset();
      mockProject.updateProject.mockRejectedValue(new Error('Database error'));

      const input = {
        projectId: mockProject._id.toString(),
        autoTaskEnabled: true,
        taskThresholdTotalCount: 20,
        assignAgent: true,
      };

      try {
        await projectResolver.Mutation.updateTaskManagerSettings(
          {},
          { input },
          context
        );
        throw new Error('Expected ApolloError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApolloError);
        expect((error as ApolloError).message).toBe('Failed to update Task Manager settings');
      }
    });

    it('should update only provided settings and preserve others', async () => {
      const mockProject = createMockProject({
        taskManager: {
          ...mockTaskManagerConfig,
          autoTaskEnabled: false,
          assignAgent: false,
        },
      });
      const context = createMockContext(mockProject);

      const input = {
        projectId: mockProject._id.toString(),
        autoTaskEnabled: true,
        taskThresholdTotalCount: 30,
        assignAgent: true,
      };

      await projectResolver.Mutation.updateTaskManagerSettings(
        {},
        { input },
        context
      );

      const updateCall = mockProject.updateProject.mock.calls[0][0];
      expect(updateCall.taskManager.autoTaskEnabled).toBe(true);
      expect(updateCall.taskManager.taskThresholdTotalCount).toBe(30);
      expect(updateCall.taskManager.assignAgent).toBe(true);
      expect(updateCall.taskManager.config).toEqual(mockTaskManagerConfig.config);
      expect(updateCall.taskManager.type).toBe('github');
      expect(updateCall.taskManager.connectedAt).toEqual(mockTaskManagerConfig.connectedAt);
    });
  });
});
