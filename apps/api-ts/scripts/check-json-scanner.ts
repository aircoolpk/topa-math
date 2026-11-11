/**
 * Compare the TypeScript JSON scanner with CPython's `json` module.
 *
 * The corpus in `tmp/json-corpus.json` was produced by CPython 3.13 (the
 * version the FastAPI service runs on), so it carries the exact message and
 * character offset FastAPI reports for a malformed body.
 */
import { readFileSync } from 'node:fs'

import { parsePythonJson } from '../src/lib/billing/validation'

interface CorpusEntry {
  text: string
  ok: boolean
  pos?: number
  msg?: string
  value?: string
}

const corpus = JSON.parse(
  readFileSync(new URL('../tmp/json-corpus.json', import.meta.url), 'utf-8'),
) as CorpusEntry[]

let failures = 0
for (const entry of corpus) {
  const parsed = parsePythonJson(entry.text)
  if (entry.ok) {
    if (!parsed.ok) {
      failures += 1
      console.log(`FAIL ${JSON.stringify(entry.text)}: expected OK, got ${parsed.msg} @${parsed.pos}`)
    }
    continue
  }
  if (parsed.ok) {
    failures += 1
    console.log(`FAIL ${JSON.stringify(entry.text)}: expected error "${entry.msg}", got OK`)
    continue
  }
  if (parsed.pos !== entry.pos || parsed.msg !== entry.msg) {
    failures += 1
    console.log(
      `FAIL ${JSON.stringify(entry.text)}: expected ${entry.msg} @${entry.pos}, got ${parsed.msg} @${parsed.pos}`,
    )
  }
}

console.log(`\n${corpus.length - failures}/${corpus.length} cases match CPython`)
if (failures > 0) {
  process.exitCode = 1
}
