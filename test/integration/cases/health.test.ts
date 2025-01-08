import { apiInstance } from '../utils';

describe('Server health', () => {
  test('Server is healthy', async () => {
    const response = await apiInstance.get('.well-known/apollo/server-health');

    expect(response.status).toBe(200);
  });
});
