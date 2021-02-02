import axios from 'axios';

describe('Server health', () => {
  test('Server is healthy', async () => {
    const response = await axios.get('http://api:4000/.well-known/apollo/server-health');

    expect(response.status).toBe(200);
  });
});
