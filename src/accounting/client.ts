import https, { Agent } from 'https';
import fs from 'fs';
import axios, { AxiosInstance } from 'axios';
import {Settings} from "./types";
import set = Reflect.set;

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
   * @param settings - settings for client module
   */
  constructor(settings: Settings) {
    let httpsAgent: Agent | null = null;

    if (settings.tlsVerify) {
      httpsAgent = new https.Agent({
        ca: fs.readFileSync(settings.tlsCaCertPath || ''),
        cert: fs.readFileSync(settings.tlsCertPath || ''),
        key: fs.readFileSync(settings.tlsKeyPath || ''),
      });
    }

    this.apiInstance = axios.create({
      baseURL: settings.baseURL,
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
