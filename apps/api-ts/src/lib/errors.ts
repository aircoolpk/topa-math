/**
 * Error shapes shared by every endpoint.
 *
 * The legacy FastAPI service answers with FastAPI's default error body:
 *
 *   { "detail": "Invalid credentials" }
 *
 * and — for structured errors — `detail` may be an object such as
 * `{"code": "DATABASE_SCHEMA_NOT_READY"}`. The frontend reads
 * `error.response.data.detail` (and sometimes `detail.code`), so the TS API
 * must reproduce that envelope exactly or the UI's error handling breaks.
 */

/** Error carrying an HTTP status code and a FastAPI-compatible `detail`. */
export class HttpError extends Error {
  readonly status: number
  readonly detail: string | Record<string, unknown>
  readonly headers: Record<string, string>

  constructor(
    status: number,
    detail: string | Record<string, unknown>,
    headers: Record<string, string> = {},
  ) {
    super(typeof detail === 'string' ? detail : JSON.stringify(detail))
    this.name = 'HttpError'
    this.status = status
    this.detail = detail
    this.headers = headers
  }
}

/** 400 — the request itself is malformed. */
export function badRequest(detail: string | Record<string, unknown>): HttpError {
  return new HttpError(400, detail)
}

/** 401 — missing or invalid credentials. */
export function unauthorized(detail = 'Not authenticated'): HttpError {
  return new HttpError(401, detail)
}

/** 403 — authenticated but not allowed. */
export function forbidden(detail = 'Forbidden'): HttpError {
  return new HttpError(403, detail)
}

/** 404 — resource not found (also used to avoid leaking existence). */
export function notFound(detail = 'Not found'): HttpError {
  return new HttpError(404, detail)
}

/** 409 — conflict (e.g. email already registered). */
export function conflict(detail: string | Record<string, unknown>): HttpError {
  return new HttpError(409, detail)
}

/** 422 — semantically invalid payload. */
export function unprocessable(detail: string | Record<string, unknown>): HttpError {
  return new HttpError(422, detail)
}

/** 503 — a dependency (usually the database) is not ready. */
export function serviceUnavailable(detail: string | Record<string, unknown>): HttpError {
  return new HttpError(503, detail)
}

/** Narrowing helper for `unknown` catch values. */
export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError
}
