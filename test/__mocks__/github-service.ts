export const deleteInstallationMock = jest.fn().mockResolvedValue(undefined);

export const GitHubService = jest.fn().mockImplementation(() => ({
  deleteInstallation: deleteInstallationMock,
}));
