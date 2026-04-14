/**
 * Base error class for Kirimi SDK errors.
 */
export class KirimiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KirimiError';
    // Fix prototype chain for instanceof checks in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when the Kirimi API returns a non-2xx HTTP response.
 */
export class KirimiApiError extends KirimiError {
  readonly statusCode: number;
  readonly responseData?: unknown;

  constructor(statusCode: number, message: string, responseData?: unknown) {
    super(message);
    this.name = 'KirimiApiError';
    this.statusCode = statusCode;
    this.responseData = responseData;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a request times out.
 */
export class KirimiTimeoutError extends KirimiError {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'KirimiTimeoutError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
