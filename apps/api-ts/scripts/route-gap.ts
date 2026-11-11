/**
 * Print the exact API surface the frontend calls and the routes the Worker
 * actually registers, so the gap list is precise.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = 'C:/web-app/4-craft.com'
const SRC = join(ROOT, 'src')

// 1. The Worker's registered routes.
const { pathToFileURL } = await import('node:url')
const { createApp } = await import(pathToFileURL(join(ROOT, 'apps/api-ts/src/index.ts')).href)
const app = createApp()
const workerRoutes: string[] = []
for (const r of app.routes) {
  const path = (r as { path: string }).path
  const method = (r as { method: string }).method
  workerRoutes.push(`${method} ${path}`)
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

// 2. The paths the frontend calls.
const calls = new Map<string, Set<string>>()
const apiBase = /apiFetch\s*\(\s*[`'"]([^`'"]+)/g
const direct = /[`'"]((?:\/auth|\/me|\/children|\/site|\/rankings|\/billing|\/share|\/quiz-sessions|\/lessons|\/skills|\/subjects|\/avatar|\/referrals|\/webhooks|\/storage)[^`'"\s${]*)/g

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf-8')
  const rel = relative(ROOT, file)
  for (const re of [apiBase, direct]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const raw = m[1].split('?')[0]
      if (!raw.startsWith('/')) continue
      if (!calls.has(raw)) calls.set(raw, new Set())
      calls.get(raw)!.add(rel)
    }
  }
}

// 3. Match a concrete path against the Worker's patterns.
const concretePatterns = workerRoutes
  .map((r) => r.split(' ')[1] || '')
  .filter((p) => p && !p.includes('*') && !p.endsWith('/'))

function matches(path: string): boolean {
  return concretePatterns.some((p) => {
    const rx = new RegExp('^' + p.replace(/\{[^}]+\}/g, '[^/]+').replace(/:[^/]+/g, '[^/]+') + '$')
    return rx.test(path)
  })
}

const covered: string[] = []
const missing: Array<[string, string[]]> = []
for (const [path, files] of [...calls.entries()].sort()) {
  if (matches(path)) covered.push(path)
  else missing.push([path, [...files].slice(0, 3)])
}

console.log(`worker route patterns : ${workerRoutes.length}`)
console.log(`frontend call paths   : ${calls.size}`)
console.log(`covered               : ${covered.length}`)
console.log(`MISSING               : ${missing.length}\n`)

console.log('--- worker routes ---')
for (const r of workerRoutes.sort()) console.log('  ', r)

console.log('\n--- missing (frontend calls, no worker route) ---')
for (const [path, files] of missing) {
  console.log(`  ${path}`)
  for (const f of files) console.log(`        ${f}`)
}
