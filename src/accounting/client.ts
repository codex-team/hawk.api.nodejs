import https from 'https';
import fs from 'fs';
import axios, { AxiosInstance } from 'axios';

/**
 * Represent client for sending queries to remote service
 */
export default class Client {
  /**
   * Instance of axios for connection to CodeX Accounting API
   */
  private readonly apiInstance: AxiosInstance;

  /**
   * Create axios instance with https agent
   *
   * @param connectionURL - URL for connecting
   */
  constructor(connectionURL: string) {
    const httpsAgent = new https.Agent({
      ca: fs.readFileSync(`${__dirname}/ca.pem`),
      cert: fs.readFileSync(`${__dirname}/client.pem`),
      key: fs.readFileSync(`${__dirname}/client-key.pem`),
    });

    this.apiInstance = axios.create({
      baseURL: connectionURL,
      timeout: 1000,
      httpsAgent: httpsAgent,
    });
  }

  /**
   * Calls remote service and returns response
   *
   * @param query - request to send
   * @param variables - request variables
   */
  public async call(
    query: string,
    variables?: object
    // eslint-disable-next-line
  ): Promise<any> {
    const response = await this.apiInstance.post(this.baseURL, {
      query,
      variables,
    });

    return response;
  }

  /**
   * Returns base URL endpoint
   */
  private get baseURL(): string {
    return this.apiInstance.defaults.baseURL || '';
  }
}
