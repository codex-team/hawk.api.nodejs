import dotenv from 'dotenv';
import axios from 'axios';

export const apiEnv = dotenv.config({ path: './api.env' }).parsed || {};

export const apiInstance = axios.create({
  baseURL: `http://api:${apiEnv.PORT}`,
});
