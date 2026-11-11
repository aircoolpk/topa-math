/**
 * Request validation that mirrors FastAPI / pydantic.
 *
 * The legacy FastAPI service answers a malformed request with pydantic's
 * error list, not with a custom envelope:
 *
 * ```json
 * {"detail": [{"type": "json_invalid", "loc": ["body", 1],
 *              "msg": "JSON decode error", "input": {},
 *              "ctx": {"error": "Expecting property name enclosed in double quotes"}}]}
 * ```
 *
 * Two details are hard to reproduce and are therefore implemented here:
 *
 *  - **The JSON error position and message.** They come from CPython's
 *    `json` module, so the scanner below mirrors the C scanner of CPython
 *    3.13 (`Modules/_json.c`) — including the message wording and the
 *    character offset.
 *  - **The order of the checks.** FastAPI parses the body *before* it
 *    solves the dependencies, so a malformed body answers `422` even for an
 *    anonymous caller, while a well-formed body of the wrong shape answers
 *    `401` first and only then `422`.
 */
import { HttpError } from '../errors'

/** The JSON whitespace CPython skips. */
const WHITESPACE = ' \t\n\r'

/** A JSON value that was parsed successfully. */
export interface JsonOk {
  ok: true
  value: unknown
}

/** A JSON parse failure, with the position and message CPython reports. */
export interface JsonError {
  ok: false
  /** The character offset of the failure. */
  pos: number
  /** The message CPython's `json` module reports. */
  msg: string
}

/**
 * Parse JSON the way CPython's `json.loads` does, including the error
 * message and the character offset of a failure.
 *
 * @param text the raw body.
 */
export function parsePythonJson(text: string): JsonOk | JsonError {
  let index = 0

  /** Skip the JSON whitespace. */
  const skipWhitespace = (): void => {
    while (index < text.length && WHITESPACE.includes(text[index] as string)) {
      index += 1
    }
  }

  /** Fail with the CPython message. */
  const fail = (pos: number, msg: string): JsonError => ({ ok: false, pos, msg })

  /** Read a string; `index` points at the opening quote. */
  const scanString = (): string => {
    const begin = index
    index += 1
    let out = ''
    for (;;) {
      if (index >= text.length) {
        throw fail(begin, 'Unterminated string starting at')
      }
      const char = text[index] as string
      if (char === '"') {
        index += 1
        return out
      }
      if (char === '\\') {
        const escapeAt = index
        index += 1
        if (index >= text.length) {
          throw fail(begin, 'Unterminated string starting at')
        }
        const escape = text[index] as string
        if (escape === 'u') {
          const hex = text.slice(index + 1, index + 5)
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            throw fail(escapeAt, 'Invalid \\uXXXX escape')
          }
          out += String.fromCharCode(Number.parseInt(hex, 16))
          index += 5
          continue
        }
        const simple: Record<string, string> = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t',
        }
        if (!(escape in simple)) {
          throw fail(escapeAt, 'Invalid \\escape')
        }
        out += simple[escape] as string
        index += 1
        continue
      }
      if (char < ' ') {
        throw fail(index, 'Invalid control character at')
      }
      out += char
      index += 1
    }
  }

  /** Read a number; `index` points at its first character. */
  const scanNumber = (): number => {
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(index))
    if (!match) {
      throw fail(index, 'Expecting value')
    }
    const raw = match[0]
    // A number must be followed by a delimiter, exactly like CPython's scanner.
    const next = text[index + raw.length]
    if (next !== undefined && !WHITESPACE.includes(next) && !',]}'.includes(next)) {
      throw fail(index, 'Expecting value')
    }
    index += raw.length
    return Number(raw)
  }

  /** Read an array; `index` points at the opening bracket. */
  const scanArray = (): unknown[] => {
    index += 1
    const out: unknown[] = []
    skipWhitespace()
    if (text[index] === ']') {
      index += 1
      return out
    }
    for (;;) {
      skipWhitespace()
      out.push(scanValue())
      skipWhitespace()
      const char = text[index]
      if (char === ',') {
        const commaAt = index
        index += 1
        skipWhitespace()
        if (text[index] === ']') {
          throw fail(commaAt, 'Illegal trailing comma before end of array')
        }
        continue
      }
      if (char === ']') {
        index += 1
        return out
      }
      throw fail(index, "Expecting ',' delimiter")
    }
  }

  /** Read an object; `index` points at the opening brace. */
  const scanObject = (): Record<string, unknown> => {
    index += 1
    const out: Record<string, unknown> = {}
    skipWhitespace()
    if (text[index] === '}') {
      index += 1
      return out
    }
    for (;;) {
      skipWhitespace()
      if (text[index] !== '"') {
        throw fail(index, 'Expecting property name enclosed in double quotes')
      }
      const key = scanString()
      skipWhitespace()
      if (text[index] !== ':') {
        throw fail(index, "Expecting ':' delimiter")
      }
      index += 1
      skipWhitespace()
      out[key] = scanValue()
      skipWhitespace()
      const char = text[index]
      if (char === ',') {
        const commaAt = index
        index += 1
        skipWhitespace()
        if (text[index] === '}') {
          throw fail(commaAt, 'Illegal trailing comma before end of object')
        }
        continue
      }
      if (char === '}') {
        index += 1
        return out
      }
      throw fail(index, "Expecting ',' delimiter")
    }
  }

  /** Read any value; `index` points at its first character. */
  const scanValue = (): unknown => {
    if (index >= text.length) {
      throw fail(index, 'Expecting value')
    }
    const char = text[index] as string
    if (char === '"') {
      return scanString()
    }
    if (char === '{') {
      return scanObject()
    }
    if (char === '[') {
      return scanArray()
    }
    if (char === '-' || (char >= '0' && char <= '9')) {
      return scanNumber()
    }
    const literal = text.startsWith('null', index)
      ? 'null'
      : text.startsWith('true', index)
        ? 'true'
        : text.startsWith('false', index)
          ? 'false'
          : null
    if (literal === null) {
      throw fail(index, 'Expecting value')
    }
    index += literal.length
    if (literal === 'null') {
      return null
    }
    return literal === 'true'
  }

  try {
    skipWhitespace()
    const value = scanValue()
    skipWhitespace()
    if (index !== text.length) {
      throw fail(index, 'Extra data')
    }
    return { ok: true, value }
  } catch (error) {
    if (error && typeof error === 'object' && 'ok' in error && (error as JsonError).ok === false) {
      return error as JsonError
    }
    return fail(0, 'Expecting value')
  }
}

/**
 * The pydantic error list of a request FastAPI rejected.
 *
 * @param details the pydantic error entries.
 */
export function validationError(details: Array<Record<string, unknown>>): HttpError {
  // `HttpError.detail` is typed as an object, but FastAPI sends a *list*.
  return new HttpError(422, details as unknown as Record<string, unknown>)
}

/**
 * The `json_invalid` error of a body CPython could not parse.
 *
 * @param pos the character offset of the failure.
 * @param msg the message CPython reports.
 */
export function jsonInvalidError(pos: number, msg: string): HttpError {
  return validationError([
    {
      type: 'json_invalid',
      loc: ['body', pos],
      msg: 'JSON decode error',
      input: {},
      ctx: { error: msg },
    },
  ])
}

/**
 * The error of a body that is not a JSON object.
 *
 * @param input the body as FastAPI received it.
 */
export function modelAttributesError(input: unknown): HttpError {
  return validationError([
    {
      type: 'model_attributes_type',
      loc: ['body'],
      msg: 'Input should be a valid dictionary or object to extract fields from',
      input,
    },
  ])
}

/**
 * The error of a request without a body.
 */
export function missingBodyError(): HttpError {
  return validationError([{ type: 'missing', loc: ['body'], msg: 'Field required', input: null }])
}

/**
 * The error of a body that does not carry the required field.
 *
 * @param field the name of the field.
 * @param input the body as FastAPI received it.
 */
export function missingFieldError(field: string, input: unknown): HttpError {
  return validationError([{ type: 'missing', loc: ['body', field], msg: 'Field required', input }])
}

/**
 * The error of a field that is not a string.
 *
 * @param field the name of the field.
 * @param input the value of the field.
 */
export function stringTypeError(field: string, input: unknown): HttpError {
  return validationError([
    { type: 'string_type', loc: ['body', field], msg: 'Input should be a valid string', input },
  ])
}
