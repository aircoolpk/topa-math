'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminApi, type ContentQualityReport } from '@/lib/api/admin'

const issueLabels: Record<string, string> = {
  missing_thp_lesson: 'Missing THP lesson',
  missing_ep_lesson: 'Missing EP lesson',
  missing_singapore_math_model: 'Missing Singapore Math model',
  missing_diagram: 'Missing diagram',
  placeholder_text: 'Placeholder text',
  fewer_than_10_questions: 'Fewer than 10 questions',
  invalid_answer_key: 'Invalid answer key',
  missing_explanation: 'Missing explanation',
  inappropriate_language: 'Language issue',
  ambiguous_wording: 'Ambiguous wording',
  overly_difficult_english: 'Difficult English',
  duplicate_story_template: 'Duplicate story',
  generic_practice: 'Generic practice',
  model_number_mismatch: 'Model mismatch',
  number_sentence_mismatch: 'Number sentence mismatch',
  bare_equation_quiz: 'Bare equation quiz',
  thai_in_en_field: 'Thai in English field',
  english_in_th_content: 'English in TH content',
  zero_fallback_model: 'Zero fallback model',
  weak_story: 'Weak story',
  weak_practice: 'Weak practice',
  quiz_choices_invalid: 'Quiz choices invalid',
}

export default function AdminContentQualityPage() {
  const [report, setReport] = useState<ContentQualityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [issueFilter, setIssueFilter] = useState('all')

  useEffect(() => {
    let mounted = true
    adminApi.contentQuality()
      .then((data) => {
        if (mounted) setReport(data)
      })
      .catch((err) => {
        if (mounted) setError(err?.response?.data?.detail || 'Could not load content quality report')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const issueCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    report?.lessons.forEach((lesson) => {
      lesson.issues.forEach((issue) => {
        counts[issue.code] = (counts[issue.code] || 0) + 1
      })
    })
    report?.missing_tracks.forEach((item) => {
      counts[item.code] = (counts[item.code] || 0) + 1
    })
    return counts
  }, [report])

  const filteredLessons = useMemo(() => {
    if (!report) return []
    if (issueFilter === 'all') return report.lessons
    if (issueFilter === 'none') return report.lessons.filter((lesson) => lesson.issues.length === 0)
    return report.lessons.filter((lesson) => lesson.issues.some((issue) => issue.code === issueFilter))
  }, [issueFilter, report])

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Admin</p>
            <h1 className="text-3xl font-extrabold text-gray-950">Content Quality</h1>
            <p className="mt-1 text-sm text-gray-500">THP and EP lesson readiness before student publishing.</p>
          </div>
          <Link href="/admin/generated-content" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
            Generated content
          </Link>
        </div>

        {loading && <div className="rounded-lg bg-white p-6 text-gray-500 shadow-sm">Loading quality report...</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">{error}</div>}

        {report && (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              <Metric label="Lessons" value={report.summary.total_lessons} />
              <Metric label="Publishable" value={report.summary.publishable} />
              <Metric label="Needs review" value={report.summary.needs_review} />
              <Metric label="Missing tracks" value={report.summary.missing_tracks} />
            </section>

            <section className="rounded-lg bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-gray-900">Issue checklist</h2>
                <select
                  value={issueFilter}
                  onChange={(event) => setIssueFilter(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                >
                  <option value="all">All lessons</option>
                  <option value="none">No warnings</option>
                  {Object.entries(issueLabels).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(issueLabels).map(([code, label]) => (
                  <div key={code} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className={`font-bold ${issueCounts[code] ? 'text-red-600' : 'text-green-600'}`}>{issueCounts[code] || 0}</span>
                  </div>
                ))}
              </div>
            </section>

            {report.missing_tracks.length > 0 && (
              <section className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">Missing THP / EP pairs</h2>
                <div className="mt-3 divide-y divide-gray-100">
                  {report.missing_tracks.slice(0, 30).map((item) => (
                    <div key={`${item.topic_code}-${item.missing}`} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-mono text-gray-700">{item.topic_code}</span>
                      <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">Missing {item.missing}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-lg bg-white shadow-sm">
              <div className="border-b border-gray-100 p-5">
                <h2 className="text-lg font-bold text-gray-900">Lesson publish status</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Lesson</th>
                      <th className="px-4 py-3">Track</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLessons.map((lesson) => (
                      <tr key={lesson.lesson_id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{lesson.title || lesson.lesson_id}</p>
                          <p className="font-mono text-xs text-gray-400">{lesson.lesson_id}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-700">{lesson.program_type}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${lesson.publishable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {lesson.publishable ? 'publishable' : lesson.publish_status || 'needs_review'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {lesson.issues.length === 0 ? (
                            <span className="text-green-600">No issues</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {lesson.issues.slice(0, 5).map((issue, index) => (
                                <span key={`${issue.code}-${index}`} className="rounded bg-gray-100 px-2 py-1 text-xs">
                                  {issueLabels[issue.code] || issue.code}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-gray-950">{value}</p>
    </div>
  )
}
