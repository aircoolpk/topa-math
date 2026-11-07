import { apiClient } from '@/lib/api-client'
import type { AxiosError } from 'axios'
import type { HomepageConfig } from '@/lib/topa-content'

export interface AIGenerationJob {
  id: string
  skill_id: string
  grade_level: number
  status: 'pending' | 'generating' | 'completed' | 'rejected'
  content: string | null
  created_at: string
  reviewed_at: string | null
}

export interface ContentQualityIssue {
  code: string
  message: string
  severity: 'error' | 'warning'
}

export interface ContentQualityLesson {
  lesson_id: string
  program_type: 'THP' | 'EP' | 'UNKNOWN'
  grade_level?: number
  topic_code?: string
  title?: string
  source_path?: string
  quiz_path?: string | null
  publish_status: string
  publishable: boolean
  issues: ContentQualityIssue[]
}

export interface ContentQualityReport {
  summary: {
    total_lessons: number
    publishable: number
    needs_review: number
    missing_tracks: number
    issue_counts?: Record<string, number>
  }
  missing_tracks: Array<{ topic_code: string; missing: 'THP' | 'EP'; code: string }>
  lessons: ContentQualityLesson[]
}

export interface AdminMetrics {
  total_users: number
  free_users: number
  trial_users: number
  paid_users: number
  thp_users?: number
  ep_users?: number
  family_users?: number
  manual_grant_users?: number
  canceled_users: number
  expired_users: number
  active_subscriptions: number
  users_by_plan: Record<string, number>
  monthly_revenue: number
  total_revenue: number
  mrr: number
  arpu: number
  revenue_by_plan: Record<string, number>
  new_users_today: number
  new_users_this_month: number
}

export interface AdminOverview {
  members: {
    total: number
    free: number
    paid: number
    paid_th: number
    paid_ep: number
  }
  students: {
    total: number
    by_grade: Array<{ grade: number; count: number }>
    by_gender: Array<{ gender: 'male' | 'female' | 'other' | 'unknown'; count: number }>
    by_age: Array<{ age: number | string; count: number }>
  }
  content: {
    lessons_total: number
    questions_total: number
    tests_total: number
    draft: number
    pending: number
    approved: number
    rejected: number
  }
}

export interface AdminUserRow {
  id?: string
  user_id: string
  name?: string | null
  email?: string | null
  role?: string | null
  storage_role?: string | null
  plan?: string | null
  plan_expires_at?: string | null
  is_active?: boolean
  membership_status?: string | null
  subscription_status?: string | null
  plan_type?: string | null
  plan_code?: string | null
  plan_name?: string | null
  program_type?: string | null
  trial_ends_at?: string | null
  current_period_end?: string | null
  access_ends_at?: string | null
  remaining_time?: string | null
  admin_note?: string | null
  manual_grant_reason?: string | null
  created_at?: string | null
  last_login_at?: string | null
  number_of_child_profiles?: number
  children_count?: number
  actions?: string[]
}

export interface AdminPlanPayload {
  plan?: 'free' | 'reviewer' | 'founder' | 'plus' | 'pro'
  plan_expires_at?: string | null
  reason?: string
  note?: string
  plan_type?: 'free' | 'thp' | 'ep' | 'family' | 'reviewer'
  program_type?: 'FREE' | 'THP' | 'EP' | 'BOTH'
  subscription_status?: 'free' | 'active' | 'trial' | 'manual_grant' | 'expired' | 'canceled'
  access_ends_at?: string | null
  admin_note?: string
  manual_grant_reason?: string
}

export interface AdminSummary {
  total_users: number
  active_users: number
  free_users: number
  paid_reviewer_users: number
  reviewer_users: number
  total_children: number
  total_test_sessions: number
  lessons_visible_by_grade: Record<string, number>
  th_ep_content_coverage: { has_th: number; has_ep: number; total: number }
  content_gaps: AdminLessonStatus[]
}

export interface AdminLessonStatus {
  lesson_id: string
  grade_level: number
  title_th: string
  title_ep?: string | null
  has_th: boolean
  has_ep: boolean
  has_test: boolean
  visual_status: string
  beta_visible: boolean
  enabled: boolean
  validation_status: string
  issue_count: number
}

export interface AdminChildRow {
  id: string
  child_id: string
  parent_email?: string | null
  nickname?: string | null
  name?: string | null
  grade?: number | null
  grade_level?: number | null
  xp?: number | null
  level?: number | null
  rank?: string | null
  created_at?: string | null
}

export interface AdminTestRow {
  id?: string
  test_id?: string
  question_id?: string
  session_id?: string
  user?: { id: string; email: string } | null
  child?: { id: string; nickname: string } | null
  lesson_id?: string | null
  base_lesson_id?: string | null
  program?: string | null
  language?: string | null
  grade?: number | null
  grade_level?: number | null
  question?: string | null
  choices?: string[]
  correct_answer?: string | null
  explanation?: string | null
  difficulty?: string | null
  skill_tag?: string | null
  source_path?: string | null
  source_folder?: string | null
  topic_folder?: string | null
  quiz_variant_count?: number | null
  approved_quiz_count?: number | null
  file_structure?: string | null
  score?: { total_questions: number; correct_count: number; accuracy: number } | null
  status?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export interface AdminSubscriptionRow {
  subscription_id: string
  user_id?: string
  email?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  membership_status?: string
  subscription_status?: string
  plan_code?: string
  active_price_code?: string | null
  plan_name?: string
  program_type?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean
  monthly_amount_thb?: number
  created_at?: string | null
}

export interface AdminRevenue {
  revenue_today: number
  revenue_this_month: number
  revenue_total?: number
  total_revenue: number
  monthly_revenue: number
  mrr: number
  arpu: number
  revenue_by_plan: Record<string, number>
  paid_users_by_plan: Record<string, number>
  conversion_rate: number
  is_mock?: boolean
  note?: string
}

export interface AdminReferralRow {
  id: string
  referrer_user_id: string
  referrer_email?: string | null
  referred_user_id?: string | null
  referred_email?: string | null
  status: 'clicked' | 'registered' | 'paid'
  coins_awarded?: number
  reward_status?: 'pending' | 'active' | 'reversed' | null
  ledger_id?: string | null
  created_at?: string | null
  visitor_hash?: string | null
}

export interface AdminReferralResponse {
  rows: AdminReferralRow[]
  summary: {
    clicks: number
    registered: number
    paid: number
    pending_coins: number
    active_coins: number
  }
}

export interface AdminAffiliateResponse {
  affiliates: Array<{
    user_id: string
    email_masked?: string | null
    registered_count: number
    paid_member_count: number
    total_referred_paid_minor: number
    total_commission_minor: number
    pending_balance_minor: number
    available_balance_minor: number
    withdrawn_balance_minor: number
  }>
  withdrawals: Array<{
    id: string
    user_id: string
    email_masked?: string | null
    amount_minor: number
    currency: string
    status: 'pending_review' | 'approved' | 'processing' | 'paid' | 'rejected'
    admin_note?: string | null
    requested_at?: string | null
    paid_at?: string | null
    payout_account?: {
      payout_method: string
      account_holder_name: string
      bank_name?: string | null
      account_masked?: string | null
      promptpay_masked?: string | null
    } | null
  }>
  recent_commissions: Array<{
    id: string
    affiliate_email_masked?: string | null
    referred_email_masked?: string | null
    amount_paid_minor: number
    commission_minor: number
    status: string
    created_at?: string | null
  }>
  summary: {
    registered: number
    paid_members: number
    total_commission_minor: number
    available_balance_minor: number
  }
}

export interface AdminLessonRow {
  lesson_id: string
  db_lesson_id?: string | null
  title?: string | null
  title_th?: string | null
  grade?: number | null
  subject?: string | null
  topic?: string | null
  program_type?: string | null
  published_status?: string | null
  status?: string | null
  completeness_score?: number | null
  quiz_questions_count?: number | null
  validation_errors?: ContentQualityIssue[]
  updated_at?: string | null
  is_mock?: boolean
}

// ─── Admin Content Manager types ────────────────────────────────────────────────

export interface ContentTHPContent {
  title_th?: string
  learning_objective_th?: string
  lesson_intro_th?: string
  concept_explanation_th?: string
  step_by_step_th?: Array<{ step: number; title_th: string; description_th: string }>
  worked_examples_th?: Array<{
    problem: string
    solution_steps: string[]
    answer: string
    explanation: string
  }>
  common_mistakes_th?: Array<{
    mistake: string
    why_it_happens: string
    correct_way: string
  }>
  [key: string]: unknown
}

export interface ContentEPContent {
  title_en?: string
  title_th?: string
  learning_objective_en?: string
  learning_objective_th?: string
  vocabulary?: Array<{
    word_en: string
    meaning_th: string
    example_en: string
    example_th: string
  }>
  concept_explanation_en?: string
  concept_explanation_th?: string
  step_by_step_en?: string[]
  step_by_step_th?: string[]
  worked_examples?: Array<{
    problem_en: string
    problem_th: string
    solution_steps_en: string[]
    solution_steps_th: string[]
    answer: string
    explanation_en: string
    explanation_th: string
  }>
  common_mistakes?: Array<{
    mistake_en: string
    mistake_th: string
    correction_en: string
    correction_th: string
  }>
  [key: string]: unknown
}

export interface ContentValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ─── Time-range analytics types ────────────────────────────────────────────────

export type TimeRange = 'today' | 'week' | 'month' | 'year' | 'custom'
export type ProgramFilter = 'ALL' | 'TH' | 'EP'
export type PlanFilter = 'ALL' | 'FREE' | 'TRIAL' | 'PAID'

export interface RevenueDataPoint {
  date: string          // ISO date "2025-05-08"
  revenue: number       // revenue in THB
  signups: number       // new users that day
  paid_users: number    // active paid users that day
  trial_users: number
}

export interface RevenueSummary {
  total_revenue: number
  total_signups: number
  mrr: number
  arpu: number
  conversion_rate: number  // paid / (free + trial)
  is_mock?: boolean
  note?: string
}

export interface MemberSegmentation {
  total: number
  th: number
  ep: number
  free: number
  trial: number
  paid: number
  canceled: number
  expired: number
}

export interface RevenueTrendPoint {
  label: string   // e.g. "Mon", "Jan", "2025"
  revenue: number
  signups: number
}

export interface RevenueByPlan {
  plan: string
  users: number
  revenue: number
}

export interface ConversionFunnelStep {
  stage: string   // 'Visitor' | 'Sign Up' | 'Trial' | 'Paid'
  count: number
  pct: number      // % of total visitors
}

export interface DashboardMetrics {
  range: TimeRange
  custom_start?: string
  custom_end?: string
  program: ProgramFilter
  plan: PlanFilter
  summary: RevenueSummary
  segmentation: MemberSegmentation
  revenue_trend: RevenueTrendPoint[]
  program_trend: RevenueTrendPoint[]   // TH vs EP
  plan_trend: RevenueTrendPoint[]       // Free vs Paid
  revenue_by_plan: RevenueByPlan[]
  conversion_funnel: ConversionFunnelStep[]
  is_mock?: boolean
  note?: string
}

// ─── Mock data generator ──────────────────────────────────────────────────────

function generateMockMetrics(
  range: TimeRange,
  program: ProgramFilter,
  plan: PlanFilter,
  customStart?: string,
  customEnd?: string,
): DashboardMetrics {
  const isMock = true

  // Determine date range
  const now = new Date()
  let startDate: Date
  let endDate = new Date(now)
  let points = 0

  switch (range) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      points = 1
      break
    case 'week':
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
      points = 7
      break
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      points = endDate.getDate()
      break
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1)
      points = 12
      break
    case 'custom':
      startDate = customStart ? new Date(customStart) : new Date(now.getFullYear(), 0, 1)
      endDate = customEnd ? new Date(customEnd) : now
      points = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      points = 30
  }

  const dateLabel = (d: Date, r: TimeRange) => {
    if (r === 'today') return 'วันนี้'
    if (r === 'week') return d.toLocaleDateString('th-TH', { weekday: 'short' })
    if (r === 'month') return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    if (r === 'year') return d.toLocaleDateString('th-TH', { month: 'short' })
    return d.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
  }

  const revenue_trend: RevenueTrendPoint[] = []
  const program_trend: RevenueTrendPoint[] = []
  const plan_trend: RevenueTrendPoint[] = []

  for (let i = 0; i < points; i++) {
    const d = new Date(startDate)
    if (range === 'week' || range === 'today') d.setDate(startDate.getDate() + i)
    else if (range === 'month' || range === 'custom') d.setDate(startDate.getDate() + i)
    else d.setMonth(startDate.getMonth() + i)

    const seed = (d.getTime() / 100000) * 137.5
    const baseRevenue = 500 + (Math.sin(seed) + 1) * 2500
    const signups = Math.floor(2 + (Math.cos(seed * 0.7) + 1) * 8)

    const revPt: RevenueTrendPoint = {
      label: dateLabel(d, range),
      revenue: Math.round(baseRevenue),
      signups,
    }
    revenue_trend.push(revPt)
    program_trend.push({
      label: revPt.label,
      revenue: Math.round(revPt.revenue * (0.6 + (Math.sin(seed * 1.3) + 1) * 0.2)),
      signups: Math.floor(revPt.signups * (0.55 + (Math.cos(seed) + 1) * 0.2)),
    })
    plan_trend.push({
      label: revPt.label,
      revenue: Math.round(revPt.revenue * (0.3 + (Math.sin(seed * 0.9) + 1) * 0.15)),
      signups: Math.floor(revPt.signups * (0.4 + (Math.cos(seed * 1.1) + 1) * 0.15)),
    })
  }

  const totalRevenue = revenue_trend.reduce((s, p) => s + p.revenue, 0)
  const totalSignups = revenue_trend.reduce((s, p) => s + p.signups, 0)
  const paidUsers = Math.floor(totalSignups * 0.18)
  const trialUsers = Math.floor(totalSignups * 0.22)

  const segmentation: MemberSegmentation = {
    total: totalSignups * 4,
    th: Math.floor(totalSignups * 4 * 0.72),
    ep: Math.floor(totalSignups * 4 * 0.28),
    free: Math.floor(totalSignups * 4 * 0.6),
    trial: trialUsers,
    paid: paidUsers,
    canceled: Math.floor(totalSignups * 0.05),
    expired: Math.floor(totalSignups * 0.08),
  }

  if (program === 'TH') {
    segmentation.ep = 0
    segmentation.total = segmentation.th + segmentation.free + segmentation.trial + segmentation.paid + segmentation.canceled + segmentation.expired
  } else if (program === 'EP') {
    segmentation.th = 0
    segmentation.total = segmentation.ep + segmentation.free + segmentation.trial + segmentation.paid + segmentation.canceled + segmentation.expired
  }

  if (plan === 'FREE') {
    segmentation.paid = 0
    segmentation.trial = 0
  } else if (plan === 'TRIAL') {
    segmentation.free = 0
    segmentation.paid = 0
  } else if (plan === 'PAID') {
    segmentation.free = 0
    segmentation.trial = 0
  }

  const mrr = Math.round(totalRevenue / (range === 'today' ? 30 : range === 'week' ? 4 : range === 'month' ? 1 : 12) * 30)
  const arpu = paidUsers > 0 ? Math.round(mrr / paidUsers) : 0
  const conversion_rate = totalSignups > 0 ? Math.round((paidUsers / totalSignups) * 100) / 100 : 0

  const revenue_by_plan: RevenueByPlan[] = [
    { plan: 'รายเดือน (TH)', users: Math.floor(paidUsers * 0.65), revenue: Math.round(mrr * 0.65) },
    { plan: 'รายเดือน (EP)', users: Math.floor(paidUsers * 0.35), revenue: Math.round(mrr * 0.35) },
    { plan: 'Trial', users: trialUsers, revenue: 0 },
    { plan: 'Free', users: segmentation.free, revenue: 0 },
  ]

  const funnelTotal = totalSignups * 6
  const conversion_funnel: ConversionFunnelStep[] = [
    { stage: 'ผู้เข้าชม', count: funnelTotal, pct: 100 },
    { stage: 'สมัครใช้งาน', count: Math.round(funnelTotal * 0.4), pct: 40 },
    { stage: 'เริ่ม Trial', count: Math.round(funnelTotal * 0.25), pct: 25 },
    { stage: 'Upgrade เป็น Paid', count: paidUsers, pct: Math.round((paidUsers / funnelTotal) * 100) },
  ]

  return {
    range,
    custom_start: customStart,
    custom_end: customEnd,
    program,
    plan,
    summary: {
      total_revenue: totalRevenue,
      total_signups: totalSignups,
      mrr,
      arpu,
      conversion_rate,
      is_mock: true,
      note: '⚠️ Mock data — รอ endpoint GET /admin/dashboard/metrics',
    },
    segmentation,
    revenue_trend,
    program_trend,
    plan_trend,
    revenue_by_plan,
    conversion_funnel,
    is_mock: true,
    note: '⚠️ Mock data — รอ backend endpoint GET /admin/dashboard/metrics',
  }
}

export const dashboardApi = {
  async getMetrics(params: {
    range: TimeRange
    program?: ProgramFilter
    plan?: PlanFilter
    custom_start?: string
    custom_end?: string
  }): Promise<DashboardMetrics> {
    // TODO: replace with real API call
    // GET /admin/dashboard/metrics?range=daily|weekly|monthly|yearly&program=ALL|TH|EP&plan=ALL|FREE|TRIAL|PAID&start=...&end=...
    await new Promise((r) => setTimeout(r, 300)) // simulate network
    return generateMockMetrics(params.range, params.program ?? 'ALL', params.plan ?? 'ALL', params.custom_start, params.custom_end)
  },
}

export interface AdminContentQuestion {
  question_id: string
  lesson_id: string
  question?: string
  question_th?: string
  choices?: { A: string; B: string; C: string; D: string }
  correct_answer?: string
  explanation?: string
  explanation_th?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  skill_tag?: string
  status?: string
  [key: string]: unknown
}

export interface AdminContentLesson {
  lesson_id: string
  title?: string
  title_en?: string
  grade?: number
  subject?: string
  topic?: string
  program_type?: string
  status?: string
  completeness_score?: number
  quiz_count?: number
  error_count?: number
  updated_at?: string
  content_thp?: ContentTHPContent
  content_ep?: ContentEPContent
  quiz?: AdminContentQuestion[]
  [key: string]: unknown
}

export const adminApi = {
  errorMessage(error: unknown, fallback = 'โหลดข้อมูลไม่สำเร็จ') {
    const err = error as AxiosError<{ detail?: unknown; message?: unknown }>
    const baseURL = err.config?.baseURL || ''
    const url = err.config?.url || ''
    const endpoint = `${baseURL}${url}`
    const status = err.response?.status ? `HTTP ${err.response.status}` : 'network'
    const detail = err.response?.data?.detail ?? err.response?.data?.message ?? err.message
    const message = typeof detail === 'string' ? detail : JSON.stringify(detail || {})
    return `${fallback}\nEndpoint: ${endpoint || '-'}\nStatus: ${status}\nMessage: ${message || '-'}`
  },

  async overview() {
    const res = await apiClient.get('/admin/overview')
    return res.data as AdminOverview
  },

  async summary() {
    const res = await apiClient.get('/admin/summary')
    return res.data as AdminSummary
  },

  async generatedContent() {
    const res = await apiClient.get('/admin/generated-content')
    return res.data as AIGenerationJob[]
  },

  async contentQuality() {
    const res = await apiClient.get('/admin/content-quality')
    return res.data as ContentQualityReport
  },

  async homepage() {
    const res = await apiClient.get('/admin/homepage')
    return res.data as { config: HomepageConfig; backups: Array<{ name: string; path: string; created_at: string }> }
  },

  async saveHomepage(config: HomepageConfig) {
    const res = await apiClient.patch('/admin/homepage', { config })
    return res.data as { saved: boolean; backup?: { backup_path: string }; config: HomepageConfig }
  },

  async validateHomepage(config: HomepageConfig) {
    const res = await apiClient.post('/admin/homepage/validate', { config })
    return res.data as { valid: boolean }
  },

  async backupHomepage() {
    const res = await apiClient.post('/admin/homepage/backup')
    return res.data as { backup_path: string }
  },

  async restoreHomepage(backupName: string) {
    const res = await apiClient.post('/admin/homepage/restore', { backup_name: backupName })
    return res.data as { restored: boolean; config: HomepageConfig }
  },

  async metrics() {
    const res = await apiClient.get('/admin/metrics')
    return res.data as AdminMetrics
  },

  async users(params?: { search?: string; plan?: string; role?: string; active?: boolean | ''; limit?: number; offset?: number }) {
    const res = await apiClient.get('/admin/users', { params })
    return res.data as { users: AdminUserRow[]; total: number; limit: number; offset: number }
  },

  async getUser(userId: string) {
    const res = await apiClient.get(`/admin/users/${userId}`)
    return res.data as {
      profile: AdminUserRow
      user: AdminUserRow
      children: AdminChildRow[]
      recent_test_sessions: AdminTestRow[]
      recent_lesson_activity: Array<Record<string, unknown>>
      subscription_summary: Record<string, unknown>
    }
  },

  async changeUserRole(userId: string, role: string, adminNote?: string) {
    const res = await apiClient.patch(`/admin/users/${userId}/role`, { role, admin_note: adminNote })
    return res.data as AdminUserRow
  },

  async changeUserPlan(userId: string, payload: AdminPlanPayload) {
    const res = await apiClient.patch(`/admin/users/${userId}/plan`, payload)
    return res.data as AdminUserRow
  },

  async referrals() {
    const res = await apiClient.get('/admin/referrals')
    return res.data as AdminReferralResponse
  },

  async affiliates() {
    const res = await apiClient.get('/admin/affiliates')
    return res.data as AdminAffiliateResponse
  },

  async updateAffiliateWithdrawal(withdrawalId: string, action: 'approve' | 'processing' | 'paid' | 'reject', adminNote?: string) {
    const res = await apiClient.post(`/admin/affiliates/withdrawals/${withdrawalId}/${action}`, { admin_note: adminNote })
    return res.data as { ok: boolean }
  },

  async approveReferralCoins(ledgerId: string) {
    const res = await apiClient.post(`/admin/referrals/ledger/${ledgerId}/approve`)
    return res.data as { ok: boolean; ledger_id: string; status: string }
  },

  async reverseReferralCoins(ledgerId: string) {
    const res = await apiClient.post(`/admin/referrals/ledger/${ledgerId}/reverse`)
    return res.data as { ok: boolean; ledger_id: string; status: string }
  },

  async changeUserActive(userId: string, isActive: boolean, adminNote?: string) {
    const res = await apiClient.patch(`/admin/users/${userId}/active`, { is_active: isActive, admin_note: adminNote })
    return res.data as AdminUserRow
  },

  async children(params?: { grade?: number | ''; limit?: number; offset?: number }) {
    const res = await apiClient.get('/admin/students', { params })
    return res.data as { children: AdminChildRow[]; total: number; limit: number; offset: number }
  },

  async tests(params?: { grade?: number | ''; lesson?: string; lesson_id?: string; language?: string; program_type?: string; status?: string; limit?: number; offset?: number }) {
    const res = await apiClient.get('/admin/tests', { params })
    return res.data as { tests: AdminTestRow[]; total: number; limit: number; offset: number }
  },

  async lessonsStatus() {
    const res = await apiClient.get('/admin/lessons/status')
    return res.data as { lessons: AdminLessonStatus[] }
  },

  async systemHealth() {
    const res = await apiClient.get('/admin/system/health')
    return res.data as {
      api_status: string
      database_status: string
      redis_status: string
      content_file_count: number
      environment: string
      app_version?: string
    }
  },

  async extendUserSubscription(userId: string, days = 30, adminNote?: string) {
    const res = await apiClient.post(`/admin/users/${userId}/extend-subscription`, { days, admin_note: adminNote })
    return res.data as AdminUserRow
  },

  async cancelUserSubscription(userId: string, adminNote?: string) {
    const res = await apiClient.post(`/admin/users/${userId}/cancel-subscription`, { admin_note: adminNote })
    return res.data as AdminUserRow
  },

  async reactivateUserSubscription(userId: string, days = 30, adminNote?: string) {
    const res = await apiClient.post(`/admin/users/${userId}/reactivate-subscription`, { days, admin_note: adminNote })
    return res.data as AdminUserRow
  },

  async setUserFree(userId: string, adminNote?: string) {
    const res = await apiClient.post(`/admin/users/${userId}/set-free`, { admin_note: adminNote })
    return res.data as AdminUserRow
  },

  async expireOverdueSubscriptions() {
    const res = await apiClient.post('/admin/subscriptions/expire-overdue')
    return res.data as { expired_count: number }
  },

  async subscriptions() {
    const res = await apiClient.get('/admin/subscriptions')
    return res.data as { subscriptions: AdminSubscriptionRow[] }
  },

  async revenue() {
    const res = await apiClient.get('/admin/revenue')
    return res.data as AdminRevenue
  },

  async lessons() {
    const res = await apiClient.get('/admin/lessons')
    return res.data as { lessons: AdminLessonRow[] }
  },

  async updateUser(userId: string, payload: Record<string, unknown>) {
    const res = await apiClient.patch(`/admin/users/${userId}`, payload)
    return res.data
  },

  async updateSubscription(subscriptionId: string, payload: Record<string, unknown>) {
    const res = await apiClient.patch(`/admin/subscriptions/${subscriptionId}`, payload)
    return res.data
  },

  async updateLesson(lessonId: string, payload: Record<string, unknown>) {
    const res = await apiClient.patch(`/admin/lessons/${lessonId}`, payload)
    return res.data
  },

  async approve(jobId: string) {
    const res = await apiClient.patch(`/admin/generated-content/${jobId}/approve`)
    return res.data as { id: string; status: string }
  },

  async reject(jobId: string) {
    const res = await apiClient.patch(`/admin/generated-content/${jobId}/reject`)
    return res.data as { id: string; status: string }
  },
}
