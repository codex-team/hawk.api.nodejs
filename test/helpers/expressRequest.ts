import { Writable } from 'stream';
import express from 'express';

export interface CapturedResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

/**
 * The part of Express's response API the routes under test use
 */
interface FakeResponse extends Writable {
  status(code: number): FakeResponse;
  setHeader(key: string, value: string): FakeResponse;
  getHeader(key: string): string | undefined;
  writeHead(statusCode: number, headers?: Record<string, string>): FakeResponse;
  json(data: any): void;
  send(data?: any): void;
  redirect(url: string): void;
}

/**
 * Rebind inherited methods as own properties, which a prototype swap cannot hide.
 *
 * Express's expressInit runs `setPrototypeOf(res, app.response)` on every request,
 * which would otherwise leave the fake response with Node's real implementation
 * reaching for a socket that does not exist here.
 *
 * @param obj - object whose inherited methods should survive a prototype swap
 */
function pinInheritedMethodsAsOwnProperties(obj: any): void {
  let proto = Object.getPrototypeOf(obj);

  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor' || Object.prototype.hasOwnProperty.call(obj, key)) {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(proto, key);

      if (descriptor && typeof descriptor.value === 'function') {
        obj[key] = descriptor.value.bind(obj);
      }
    }

    proto = Object.getPrototypeOf(proto);
  }
}

/**
 * Fake Express response that records what a route wrote to it
 *
 * @param settle - called once with everything the route wrote to the response
 * @returns {FakeResponse} fake response object to hand to Express
 */
function createFakeResponse(settle: (result: CapturedResponse) => void): FakeResponse {
  let statusCode = 200;
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let settled = false;

  function finish(body: any): void {
    if (settled) {
      return;
    }

    settled = true;
    settle({
      status: statusCode,
      headers,
      body,
    });
  }

  const res = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
    final(callback) {
      finish(Buffer.concat(chunks).toString('utf-8'));
      callback();
    },
  }) as FakeResponse;

  pinInheritedMethodsAsOwnProperties(res);

  res.status = (code: number): FakeResponse => {
    statusCode = code;

    return res;
  };
  res.setHeader = (key: string, value: string): FakeResponse => {
    headers[key] = value;

    return res;
  };
  res.getHeader = (key: string): string | undefined => headers[key];
  res.writeHead = (statusCode_: number, newHeaders?: Record<string, string>): FakeResponse => {
    statusCode = statusCode_;
    Object.assign(headers, newHeaders);

    return res;
  };
  res.json = (data: any): void => finish(data);
  res.send = (data?: any): void => {
    if (!settled) {
      finish(data);
    }
  };
  res.redirect = (url: string): void => {
    statusCode = 302;
    finish(url);
  };

  return res;
}

/**
 * Send a request through an Express app without opening a socket
 *
 * @param app - Express application to route the request through
 * @param method - HTTP method
 * @param path - request path, without the query string
 * @param query - query parameters to append; an array value repeats the key
 * @param onResponse - called with the response before the request is routed, for a test
 * that has to act on it mid-flight
 * @returns {Promise<CapturedResponse>} status, headers and body the route produced
 */
export function makeExpressRequest(
  app: express.Application,
  method: string,
  path: string,
  query?: Record<string, string | string[]>,
  onResponse?: (res: FakeResponse) => void
): Promise<CapturedResponse> {
  return new Promise((resolve, reject) => {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(query || {})) {
      for (const entry of Array.isArray(value) ? value : [ value ]) {
        searchParams.append(key, entry);
      }
    }

    const url = query ? `${path}?${searchParams.toString()}` : path;
    const req = {
      method,
      url,
      originalUrl: url,
      path,
      query: query || {},
      headers: {},
      get: jest.fn(),
      params: {},
      body: {},
    } as any;

    const res = createFakeResponse(resolve);

    if (onResponse) {
      onResponse(res);
    }

    (app as any).handle(req, res, (err: any) => {
      if (err) {
        reject(err);
      }
    });
  });
}
