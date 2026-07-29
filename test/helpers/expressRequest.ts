import { Writable } from 'stream';
import express from 'express';

export interface CapturedResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

/**
 * Shape of the fake response {@link createFakeResponse} returns: a real Writable with the
 * subset of Express/Node's response API the AI stream route and its stream helpers exercise.
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
 * Express's expressInit middleware unconditionally runs setPrototypeOf(res, app.response)
 * on every request. That silently discards any *class* methods on our fake res (they live
 * on the class prototype, not as own properties of the instance) and falls back to Express/
 * Node's real ServerResponse implementation, which then throws trying to touch a real socket
 * that doesn't exist here. Own properties always shadow whatever a new prototype provides,
 * so binding inherited methods as own properties makes them survive the prototype swap.
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
 * Fake Express response supporting both res.json()/res.send()/res.redirect() and
 * res.write()/res.end() via stream.pipe() (as the AI stream route does). Built on a real
 * Writable so pipe() gets genuine EventEmitter semantics, with every method pinned as an
 * own property per pinInheritedMethodsAsOwnProperties above.
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
 * Sends a fake request through an Express app via its internal handle() method,
 * without opening a real socket - simulates how Express actually processes requests.
 *
 * @param app - Express application to route the request through
 * @param method - HTTP method
 * @param path - request path, without the query string
 * @param query - query parameters to append; an array value repeats the key
 * @returns {Promise<CapturedResponse>} status, headers and body the route produced
 */
export function makeExpressRequest(
  app: express.Application,
  method: string,
  path: string,
  query?: Record<string, string | string[]>
): Promise<CapturedResponse> {
  return new Promise((resolve, reject) => {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(query || {})) {
      for (const entry of Array.isArray(value) ? value : [value]) {
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

    (app as any).handle(req, res, (err: any) => {
      if (err) {
        reject(err);
      }
    });
  });
}
