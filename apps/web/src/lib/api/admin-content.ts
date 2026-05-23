/**
 * Admin Content API client — wires up to real backend endpoints in admin.py
 *
 * Endpoints:
 *   GET  /admin/content/summary
 *   GET  /admin/content/lessons
 *   GET  /admin/content/lessons/{lesson_id}
 *   PATCH /admin/content/lessons/{lesson_id}
 *   POST /admin/content/lessons/{lesson_id}/approve
 *   POST /admin/content/lessons/{lesson_id}/reject
 *   POST /admin/content/lessons/{lesson_id}/validate
 *   GET  /admin/content/tests
 *   PATCH /admin/content/tests/{question_id}
 *   POST /admin/content/tests/{question_id}/approve
 *   POST /admin/content/tests/{question_id}/reject
 */

import { apiClient } from '@/lib/api-client'

// ─── Shared types ────────────────────────────────────────────────────────────

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

export interface ContentSummary {
  total_lessons: number
  approved_lessons: number
  needs_review_lessons: number
  draft_lessons: number
  rejected_lessons: number
  archived_lessons: number
  th_lessons: number
  ep_lessons: number
  by_grade: Record<number, { total: number; approved: number; needs_review: number; draft: number }>
  total_tests: number
  approved_tests: number
  needs_review_tests: number
  draft_tests: number
}

export interface SeedContentStatusReport {
  dry_run: boolean
  force: boolean
  total_lessons_found: number
  approved_lessons: number
  needs_review_lessons: number
  draft_lessons: number
  skipped_existing_lessons: number
  total_tests_found: number
  approved_tests: number
  tests_needing_review: number
  skipped_existing_tests: number
  ep_coverage: {
    real_ep_lessons: number
    approved_ep_lessons: number
    needs_review_ep_lessons: number
  }
  warnings_by_grade: Record<string, number>
  changes: Array<Record<string, unknown>>
}

export interface LessonFilters {
  grade?: number
  grade_level?: number
  level?: number
  class_level?: number
  language?: string
  status?: string
  topic?: string
  search?: string
}

export interface TestFilters {
  grade?: number
  grade_level?: number
  level?: number
  class_level?: number
  language?: string
  lesson_id?: string
  status?: string
  difficulty?: string
  topic?: string
}

export interface AdminLessonRow {
  lesson_id: string
  grade_level: number
  language: string
  title: string
  title_th?: string
  title_en?: string
  topic: string
  status: string
  has_test: boolean
  approved_test_count: number
  issue_count: number
  updated_at: string
  approved_at?: string
  topic_folder?: string
  source_folder?: string
  source_path?: string
  variant_count?: number
  approved_variant_count?: number
  variant_files?: string[]
  file_structure?: string
}

export interface AdminLessonDetail extends AdminLessonRow {
  content?: Record<string, unknown>
  validation?: ValidationResult
  reviewer_note?: string
}

export interface LessonUpdatePayload {
  title?: string
  status?: string
  grade_level?: number
  topic?: string
  content?: Record<string, unknown>
}

export interface TestUpdatePayload {
  question?: string
  question_th?: string
  choices?: Record<string, string>
  correct_answer?: string
  explanation?: string
  explanation_th?: string
  difficulty?: string
  skill_tag?: string
  status?: string
}

export interface AdminTestRow {
  question_id: string
  lesson_id: string
  grade_level?: number
  language?: string
  question: string
  question_th?: string
  choices?: string[] | Record<string, string>
  correct_answer?: string
  explanation?: string
  explanation_th?: string
  difficulty?: string
  skill_tag?: string
  status?: string
  approved?: boolean
  created_at?: string
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** GET /admin/content/summary */
export async function getContentSummary(): Promise<ContentSummary> {
  const res = await apiClient.get<ContentSummary>('/admin/content/summary')
  return res.data
}

/** POST /admin/content/initialize */
export async function initializeMissingContentStatuses(dryRun = false): Promise<SeedContentStatusReport> {
  const res = await apiClient.post<SeedContentStatusReport>('/admin/content/initialize', null, {
    params: { dry_run: dryRun },
  })
  return res.data
}

/** GET /admin/content/lessons */
export async function getAdminLessons(params: LessonFilters = {}): Promise<AdminLessonRow[]> {
  const res = await apiClient.get<AdminLessonRow[] | { lessons?: AdminLessonRow[]; items?: AdminLessonRow[] }>('/admin/content/lessons', { params })
  return Array.isArray(res.data) ? res.data : (res.data.lessons ?? res.data.items ?? [])
}

/** GET /admin/content/lessons/{lesson_id} */
export async function getAdminLesson(
  lessonId: string,
  language?: string
): Promise<AdminLessonDetail> {
  const res = await apiClient.get<AdminLessonDetail>(
    `/admin/lessons/${lessonId}`,
    { params: language ? { language } : undefined }
  )
  return res.data
}

/** PATCH /admin/content/lessons/{lesson_id} */
export async function updateAdminLesson(
  lessonId: string,
  payload: LessonUpdatePayload
): Promise<AdminLessonRow> {
  const res = await apiClient.patch<AdminLessonRow>(
    `/admin/lessons/${lessonId}`,
    payload
  )
  return res.data
}

/** POST /admin/content/lessons/{lesson_id}/approve */
export async function approveLesson(lessonId: string, note?: string): Promise<void> {
  await apiClient.post(`/admin/lessons/${lessonId}/approve`, {
    reviewer_note: note,
  })
}

/** POST /admin/content/lessons/{lesson_id}/reject */
export async function rejectLesson(lessonId: string, note: string): Promise<void> {
  await apiClient.post(`/admin/lessons/${lessonId}/reject`, {
    reviewer_note: note,
  })
}

/** POST /admin/content/lessons/{lesson_id}/validate */
export async function validateLesson(lessonId: string): Promise<ValidationResult> {
  const res = await apiClient.post<ValidationResult>(
    `/admin/lessons/${lessonId}/validate`
  )
  return res.data
}

/** GET /admin/content/tests */
export async function getAdminTests(params: TestFilters = {}): Promise<AdminTestRow[]> {
  const res = await apiClient.get<AdminTestRow[] | { tests?: AdminTestRow[]; questions?: AdminTestRow[] }>('/admin/questions', { params })
  return Array.isArray(res.data) ? res.data : (res.data.questions ?? res.data.tests ?? [])
}

/** PATCH /admin/content/tests/{question_id} */
export async function updateAdminTest(
  questionId: string,
  payload: TestUpdatePayload
): Promise<AdminTestRow> {
  const res = await apiClient.patch<AdminTestRow>(
    `/admin/questions/${questionId}`,
    payload
  )
  return res.data
}

/** POST /admin/content/tests/{question_id}/approve */
export async function approveTest(questionId: string): Promise<void> {
  await apiClient.post(`/admin/questions/${questionId}/approve`)
}

/** POST /admin/content/tests/{question_id}/reject */
export async function rejectTest(questionId: string, note: string): Promise<void> {
  await apiClient.post(`/admin/questions/${questionId}/reject`, {
    reviewer_note: note,
  })
}

/** POST /admin/content/tests/{question_id}/validate */
export async function validateTest(questionId: string): Promise<ValidationResult> {
  const res = await apiClient.post<ValidationResult>(`/admin/questions/${questionId}/validate`)
  return res.data
}
