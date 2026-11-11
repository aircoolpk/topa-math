/**
 * Checks the lesson mapper against the real API.
 *
 * Every approved lesson is started on the API, the payload is mapped the
 * same way the master page maps it, and the result is printed so the
 * workspace, the questions, the hints, the steps and the vocabulary can be
 * inspected for each lesson.
 *
 *   npx tsx scripts/lesson-mapper-check.ts
 */
import {
  bundleFromStartResponse,
  mapLessonToProblems,
  numbersIn,
} from '../src/components/lesson/lessonMapper'

const API = process.env.QA_API ?? 'http://127.0.0.1:8001'
const EMAIL = process.env.QA_EMAIL ?? 'demo@4-craft.com'
const PASSWORD = process.env.QA_PASSWORD ?? 'demo1234'

async function call(path: string, init: RequestInit = {}, token?: string) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body }
}

async function main() {
  const login = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const token = (login.body as { access_token?: string })?.access_token
  if (!token) {
    console.error('login failed', login.status, login.body)
    process.exit(1)
  }

  const lessons = await call('/me/lessons?program_type=TH', {}, token)
  const payload = lessons.body as {
    lessons?: Array<{ id: string; title?: string; status?: string }>
  }
  const list = payload?.lessons ?? []
  console.log(`lessons from the API: ${list.length}`)

  let problems = 0
  let withWorkspace = 0
  let withHints = 0
  let withSteps = 0
  let withVocab = 0
  const failures: string[] = []

  for (const lesson of list) {
    const started = await call(
      `/me/lessons/${encodeURIComponent(lesson.id)}/start`,
      { method: 'POST' },
      token,
    )
    if (started.status !== 200) {
      failures.push(`${lesson.id}: start -> ${started.status}`)
      continue
    }
    const bundle = bundleFromStartResponse(started.body)
    const mapped = mapLessonToProblems(bundle)
    problems += mapped.length
    if (!mapped.length) {
      failures.push(`${lesson.id}: no problem mapped`)
      continue
    }
    const kinds = new Set(mapped.map((problem) => problem.workspaceType))
    if (kinds.has('none')) {
      failures.push(`${lesson.id}: workspace none`)
    } else {
      withWorkspace += 1
    }
    if (mapped.some((problem) => (problem.hint1TH ?? '').length > 0)) withHints += 1
    if (mapped.some((problem) => (problem.steps ?? []).length > 0)) withSteps += 1
    if (mapped.some((problem) => (problem.conceptMicroSteps ?? []).length > 0)) withVocab += 1

    const sample = mapped[0]
    console.log(
      `  ${lesson.id.padEnd(34)} q=${mapped.length} ws=${[...kinds].join(',')} ` +
        `choice=${sample.choices?.length ?? 0} ans=${sample.correctAnswer ?? '-'}`,
    )
  }

  console.log('')
  console.log(`problems            : ${problems}`)
  console.log(`with a workspace    : ${withWorkspace}/${list.length}`)
  console.log(`with hints          : ${withHints}/${list.length}`)
  console.log(`with steps          : ${withSteps}/${list.length}`)
  console.log(`with concept steps  : ${withVocab}/${list.length}`)
  console.log(`numbersIn('52,400') : ${JSON.stringify(numbersIn('52,400'))}`)
  console.log(`numbersIn('3, 4')   : ${JSON.stringify(numbersIn('3, 4'))}`)
  if (failures.length) {
    console.log('')
    console.log('problems:')
    for (const failure of failures) console.log('  -', failure)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
