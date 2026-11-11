/** Compares two oracle captures from capture-live-oracle.mjs. */
import { readFileSync } from 'node:fs'

const fast = JSON.parse(readFileSync('tmp/parity-fastapi/oracle-live.json', 'utf-8'))
const worker = JSON.parse(readFileSync('tmp/parity-worker/oracle-live.json', 'utf-8'))

const fastCases = fast.cases ?? fast
const workerCases = worker.cases ?? worker
const key = (c) => `${c.method ?? 'GET'} ${c.path} ${c.label ?? ''}`

const fastMap = new Map(fastCases.map((c) => [key(c), c]))
const workerMap = new Map(workerCases.map((c) => [key(c), c]))

/** Compares two values field by field, ignoring the key order. */
function diff(a, b, path = '', out = []) {
  if (out.length > 6) return out
  if (a === b) return out
  if (typeof a !== typeof b || a === null || b === null) {
    out.push(`${path || '/'}: ${JSON.stringify(a)?.slice(0, 90)} != ${JSON.stringify(b)?.slice(0, 90)}`)
    return out
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      out.push(`${path || '/'}: array shape ${JSON.stringify(a)?.slice(0, 70)} != ${JSON.stringify(b)?.slice(0, 70)}`)
      return out
    }
    for (let i = 0; i < a.length; i += 1) diff(a[i], b[i], `${path}[${i}]`, out)
    return out
  }
  if (typeof a === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) {
      if (!(k in a) || !(k in b)) {
        out.push(`${path}/${k}: ${k in a ? 'only in fastapi' : 'only in worker'}`)
        continue
      }
      diff(a[k], b[k], `${path}/${k}`, out)
    }
    return out
  }
  out.push(`${path || '/'}: ${JSON.stringify(a)?.slice(0, 90)} != ${JSON.stringify(b)?.slice(0, 90)}`)
  return out
}

let identical = 0
let statusOnly = 0
const problems = []
for (const [k, f] of fastMap) {
  const w = workerMap.get(k)
  if (!w) {
    problems.push(`MISSING in worker: ${k}`)
    continue
  }
  if (f.status !== w.status) {
    problems.push(`STATUS ${k}: fast=${f.status} worker=${w.status}`)
    continue
  }
  const d = diff(f.body, w.body)
  if (d.length === 0) {
    identical += 1
  } else {
    statusOnly += 1
    problems.push(`BODY ${k} (status ${f.status}): ${d.slice(0, 3).join(' | ')}`)
  }
}

console.log(`cases      : ${fastMap.size}`)
console.log(`identical  : ${identical}`)
console.log(`body differs: ${statusOnly}`)
console.log(`missing    : ${[...fastMap.keys()].filter((k) => !workerMap.has(k)).length}`)
console.log('')
for (const p of problems.slice(0, 25)) console.log('  -', p)
