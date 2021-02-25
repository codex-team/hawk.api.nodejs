import dotenv from 'dotenv';
import axios from 'axios';

/**
 * Env variables for API
 */
export const apiEnv = dotenv.config({ path: './api.env' }).parsed || {};

/**
 * Env variables for Accounting
 */
export const accountingEnv = dotenv.config({ path: './accounting.env' }).parsed || {};

/**
 * Axios instance to send requests to API
 */
export const apiInstance = axios.create({
  baseURL: `http://api:${apiEnv.PORT}`,
});
