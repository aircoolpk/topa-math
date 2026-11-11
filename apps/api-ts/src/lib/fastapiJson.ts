/**
 * JSON rendering that matches the legacy FastAPI service byte for byte.
 *
 * FastAPI renders its responses with Starlette's `JSONResponse`, which calls
 * `json.dumps(content, ensure_ascii=False, allow_nan=False, separators=(",", ":"))`.
 * Two details of that differ from `JSON.stringify`:
 *
 *  - **Floats keep their `.0`.** Python has a separate `float` type, so
 *    `round(0, 2)` serialises as `0.0` and never as `0`. JavaScript has a
 *    single `number` type, so `JSON.stringify(0)` produces `0`.
 *  - **Non-ASCII characters are not escaped.** `ensure_ascii=False` keeps the
 *    Thai text readable — the same as `JSON.stringify`.
 *
 * `PyFloat` marks the values that must be rendered as Python floats;
 * `toFastApiJson` then serialises the whole payload the way Starlette does.
 */

/** A number that has to be serialised like a Python `float`. */
export class PyFloat {
  /** The wrapped value. */
  readonly value: number

  /**
   * @param value the number to render as a float.
   */
  constructor(value: number) {
    this.value = value
  }
}

/**
 * Mark a number as a Python float.
 *
 * @param value the number to render as a float.
 */
export function pyFloat(value: number): PyFloat {
  return new PyFloat(value)
}

/**
 * Render a number the way Python's `repr(float)` does.
 *
 * @param value the number to render.
 */
function formatFloat(value: number): string {
  if (Number.isNaN(value)) {
    return 'NaN'
  }
  if (value === Infinity) {
    return 'Infinity'
  }
  if (value === -Infinity) {
    return '-Infinity'
  }
  if (Object.is(value, -0)) {
    return '-0.0'
  }
  if (Number.isInteger(value)) {
    return `${value < 0 ? '-' : ''}${Math.abs(value)}.0`
  }
  return String(value)
}

/**
 * Serialise a payload the way Starlette's `JSONResponse` does.
 *
 * @param value the payload to serialise.
 */
export function toFastApiJson(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }
  if (value instanceof PyFloat) {
    return formatFloat(value.value)
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null'
  }
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => toFastApiJson(item)).join(',')}]`
  }
  if (typeof value === 'object') {
    const parts: string[] = []
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) {
        continue
      }
      parts.push(`${JSON.stringify(key)}:${toFastApiJson(item)}`)
    }
    return `{${parts.join(',')}}`
  }
  return 'null'
}
