import { validateWebhookEndpoint } from '../../src/utils/webhookEndpointValidator';

describe('validateWebhookEndpoint', () => {
  it('should reject invalid URL', async () => {
    expect(await validateWebhookEndpoint('not-a-url')).toBe('Invalid webhook URL');
  });

  it('should reject ftp protocol', async () => {
    expect(await validateWebhookEndpoint('ftp://example.com/hook')).toBe('Webhook URL must use http or https protocol');
  });

  it('should reject non-standard ports', async () => {
    const result = await validateWebhookEndpoint('https://example.com:8080/hook');

    expect(result).toMatch(/port.*not allowed/);
  });

  it('should reject localhost', async () => {
    const result = await validateWebhookEndpoint('http://localhost/hook');

    expect(result).toMatch(/not allowed/);
  });

  it('should reject .local hostnames', async () => {
    const result = await validateWebhookEndpoint('http://myapp.local/hook');

    expect(result).toMatch(/not allowed/);
  });

  it('should reject private IP in URL', async () => {
    const result = await validateWebhookEndpoint('http://127.0.0.1/hook');

    expect(result).toMatch(/private/i);
  });

  it('should reject 169.254.169.254 (metadata)', async () => {
    const result = await validateWebhookEndpoint('http://169.254.169.254/latest/meta-data');

    expect(result).toMatch(/private/i);
  });

  it('should accept valid public https URL', async () => {
    const result = await validateWebhookEndpoint('https://example.com/hawk-webhook');

    expect(result).toBeNull();
  });

  it('should accept valid public http URL on port 80', async () => {
    const result = await validateWebhookEndpoint('http://example.com/hawk-webhook');

    expect(result).toBeNull();
  });
});
