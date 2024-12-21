import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';

/**
 * Env variables for API
 */
export const apiEnv = dotenv.config({ path: path.join(__dirname, './api.env') }).parsed || {};

/**
 * Env variables for Accounting
 */
export const accountingEnv = dotenv.config({ path: path.join(__dirname, './accounting.env') }).parsed || {};

/**
 * Axios instance to send requests to API
 */
export const apiInstance = axios.create({
  baseURL: `http://api:${apiEnv.PORT}`,
});
