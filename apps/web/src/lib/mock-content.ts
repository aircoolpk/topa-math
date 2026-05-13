/**
 * MOCK CONTENT DATA — Admin Content Manager Phase 1
 * TODO: Replace with real API calls when backend endpoints are ready.
 *
 * Endpoints needed from backend:
 *   GET /admin/content/grades
 *   GET /admin/content/grade/{grade}/lessons
 *   GET /admin/content/lesson/{lesson_id}
 *   PATCH /admin/content/lesson/{lesson_id}
 *   GET /admin/content/lesson/{lesson_id}/questions
 *   POST /admin/content/lesson/{lesson_id}/questions
 *   PATCH /admin/content/questions/{question_id}
 *   DELETE /admin/content/questions/{question_id}
 *   POST /admin/content/lesson/{lesson_id}/publish
 */

import type {
  AdminContentLesson,
  AdminContentQuestion,
  ContentValidationResult,
} from '@/lib/api/admin'

// ─── Mock lesson data ──────────────────────────────────────────────────────────

export const MOCK_GRADES = [1, 2, 3, 4, 5, 6] as const

export const MOCK_LESSONS_BY_GRADE: Record<number, AdminContentLesson[]> = {
  1: [
    {
      lesson_id: 'l-g1-1',
      title: 'การบวกเลขไม่เกิน 20',
      title_en: 'Addition up to 20',
      grade: 1,
      subject: 'math',
      topic: 'addition',
      program_type: 'THP',
      status: 'published',
      completeness_score: 100,
      quiz_count: 10,
      error_count: 0,
      updated_at: '2026-04-15T10:00:00Z',
    },
    {
      lesson_id: 'l-g1-2',
      title: 'การลบเลขไม่เกิน 20',
      title_en: 'Subtraction up to 20',
      grade: 1,
      subject: 'math',
      topic: 'subtraction',
      program_type: 'THP',
      status: 'needs_review',
      completeness_score: 70,
      quiz_count: 8,
      error_count: 2,
      updated_at: '2026-04-16T11:00:00Z',
    },
    {
      lesson_id: 'l-g1-3',
      title: 'การนับเบอร์ 1-100',
      title_en: 'Counting Numbers 1-100',
      grade: 1,
      subject: 'math',
      topic: 'counting',
      program_type: 'THP',
      status: 'draft',
      completeness_score: 40,
      quiz_count: 0,
      error_count: 5,
      updated_at: '2026-04-17T09:00:00Z',
    },
  ],
  2: [
    {
      lesson_id: 'l-g2-1',
      title: 'การบวกเลขสองหลัก',
      title_en: 'Two-Digit Addition',
      grade: 2,
      subject: 'math',
      topic: 'addition',
      program_type: 'THP',
      status: 'published',
      completeness_score: 100,
      quiz_count: 10,
      error_count: 0,
      updated_at: '2026-04-10T10:00:00Z',
    },
    {
      lesson_id: 'l-g2-2',
      title: 'การลบเลขสองหลัก',
      title_en: 'Two-Digit Subtraction',
      grade: 2,
      subject: 'math',
      topic: 'subtraction',
      program_type: 'THP',
      status: 'needs_review',
      completeness_score: 85,
      quiz_count: 10,
      error_count: 1,
      updated_at: '2026-04-11T14:00:00Z',
    },
    {
      lesson_id: 'l-g2-3',
      title: 'ตารางคูณ 2, 5, 10',
      title_en: 'Times Tables 2, 5, 10',
      grade: 2,
      subject: 'math',
      topic: 'multiplication',
      program_type: 'THP',
      status: 'published',
      completeness_score: 100,
      quiz_count: 12,
      error_count: 0,
      updated_at: '2026-04-12T08:00:00Z',
    },
  ],
  3: [
    {
      lesson_id: 'l-g3-1',
      title: 'การคูณด้วยแบบจำลองพื้นที่',
      title_en: 'Multiplication using Area Model',
      grade: 3,
      subject: 'math',
      topic: 'area_model_multiplication',
      program_type: 'THP',
      status: 'needs_review',
      completeness_score: 90,
      quiz_count: 10,
      error_count: 1,
      updated_at: '2026-05-01T10:00:00Z',
    },
    {
      lesson_id: 'l-g3-2',
      title: 'การหารเบื้องต้น',
      title_en: 'Introduction to Division',
      grade: 3,
      subject: 'math',
      topic: 'division',
      program_type: 'THP',
      status: 'draft',
      completeness_score: 30,
      quiz_count: 0,
      error_count: 6,
      updated_at: '2026-05-02T09:00:00Z',
    },
    {
      lesson_id: 'l-g3-3',
      title: 'เศษส่วนเบื้องต้น',
      title_en: 'Introduction to Fractions',
      grade: 3,
      subject: 'math',
      topic: 'fractions',
      program_type: 'THP',
      status: 'published',
      completeness_score: 100,
      quiz_count: 10,
      error_count: 0,
      updated_at: '2026-04-20T11:00:00Z',
    },
  ],
  4: [
    {
      lesson_id: 'l-g4-1',
      title: 'การคูณเลขสามหลัก',
      title_en: 'Three-Digit Multiplication',
      grade: 4,
      subject: 'math',
      topic: 'multiplication',
      program_type: 'THP',
      status: 'draft',
      completeness_score: 20,
      quiz_count: 0,
      error_count: 7,
      updated_at: '2026-05-01T10:00:00Z',
    },
  ],
  5: [
    {
      lesson_id: 'l-g5-1',
      title: 'เศษส่วนและทศนิยม',
      title_en: 'Fractions and Decimals',
      grade: 5,
      subject: 'math',
      topic: 'fractions_decimal',
      program_type: 'THP',
      status: 'needs_review',
      completeness_score: 75,
      quiz_count: 9,
      error_count: 2,
      updated_at: '2026-04-25T10:00:00Z',
    },
  ],
  6: [
    {
      lesson_id: 'l-g6-1',
      title: 'อัตราส่วนและร้อยละ',
      title_en: 'Ratios and Percentages',
      grade: 6,
      subject: 'math',
      topic: 'ratio_percentage',
      program_type: 'THP',
      status: 'published',
      completeness_score: 100,
      quiz_count: 10,
      error_count: 0,
      updated_at: '2026-04-30T10:00:00Z',
    },
  ],
}

// ─── Mock full lesson content ─────────────────────────────────────────────────

export const MOCK_FULL_LESSONS: Record<string, AdminContentLesson> = {
  'l-g1-1': {
    lesson_id: 'l-g1-1',
    title: 'การบวกเลขไม่เกิน 20',
    title_en: 'Addition up to 20',
    grade: 1,
    subject: 'math',
    topic: 'addition',
    program_type: 'THP',
    status: 'published',
    completeness_score: 100,
    quiz_count: 10,
    error_count: 0,
    updated_at: '2026-04-15T10:00:00Z',
    content_thp: {
      title_th: 'การบวกเลขไม่เกิน 20',
      learning_objective_th: 'นักเรียนบวกเลขไม่เกิน 20 ได้',
      lesson_intro_th: 'วันนี้เราจะเรียนรู้การบวกเลขไม่เกิน 20 มาลองดูกัน!',
      concept_explanation_th: 'การบวกคือการรวมจำนวนเข้าด้วยกัน',
      step_by_step_th: [
        { step: 1, title_th: 'นับจำนวนแรก', description_th: 'นับจำนวนแรกที่ต้องบวก' },
        { step: 2, title_th: 'นับจำนวนที่สอง', description_th: 'นับจำนวนที่ต้องบวกเพิ่ม' },
        { step: 3, title_th: 'รวมกัน', description_th: 'นับต่อจากจำนวนแรกไปอีกเท่ากับจำนวนที่สอง' },
      ],
      worked_examples_th: [
        {
          problem: '5 + 3 = ?',
          solution_steps: ['นับ 5', 'นับต่ออีก 3', 'ได้ 8'],
          answer: '8',
          explanation: '5 กับ 3 รวมกันได้ 8',
        },
      ],
      common_mistakes_th: [
        {
          mistake: 'นับผิดทิศทาง',
          why_it_happens: 'นับถอยหลังแทนที่จะนับไปข้างหน้า',
          correct_way: 'นับไปข้างหน้าเสมอ',
        },
      ],
    },
    content_ep: {
      title_en: 'Addition up to 20',
      title_th: 'การบวกเลขไม่เกิน 20',
      learning_objective_en: 'Students will be able to add numbers up to 20.',
      learning_objective_th: 'นักเรียนบวกเลขไม่เกิน 20 ได้',
      vocabulary: [
        { word_en: 'add', meaning_th: 'บวก', example_en: 'We add 5 and 3.', example_th: 'เราบวก 5 กับ 3' },
        { word_en: 'sum', meaning_th: 'ผลรวม', example_en: 'The sum is 8.', example_th: 'ผลรวมคือ 8' },
      ],
    },
    quiz: [
      {
        question_id: 'q-g1-1-1',
        lesson_id: 'l-g1-1',
        question: '5 + 3 = ?',
        choices: { A: '6', B: '7', C: '8', D: '9' },
        correct_answer: 'C',
        explanation: '5 + 3 = 8',
        difficulty: 'easy',
        skill_tag: 'addition_20',
      },
      {
        question_id: 'q-g1-1-2',
        lesson_id: 'l-g1-1',
        question: '12 + 4 = ?',
        choices: { A: '14', B: '15', C: '16', D: '17' },
        correct_answer: 'C',
        explanation: '12 + 4 = 16',
        difficulty: 'easy',
        skill_tag: 'addition_20',
      },
      {
        question_id: 'q-g1-1-3',
        lesson_id: 'l-g1-1',
        question: '8 + 7 = ?',
        choices: { A: '13', B: '14', C: '15', D: '16' },
        correct_answer: 'C',
        explanation: '8 + 7 = 15',
        difficulty: 'medium',
        skill_tag: 'addition_20',
      },
      {
        question_id: 'q-g1-1-4',
        lesson_id: 'l-g1-1',
        question: '9 + 6 = ?',
        choices: { A: '13', B: '14', C: '15', D: '16' },
        correct_answer: 'C',
        explanation: '9 + 6 = 15',
        difficulty: 'medium',
        skill_tag: 'addition_20',
      },
      {
        question_id: 'q-g1-1-5',
        lesson_id: 'l-g1-1',
        question: '11 + 8 = ?',
        choices: { A: '18', B: '19', C: '20', D: '21' },
        correct_answer: 'B',
        explanation: '11 + 8 = 19',
        difficulty: 'medium',
        skill_tag: 'addition_20',
      },
      {
        question_id: 'q-g1-1-6',
        lesson_id: 'l-g1-1',
        question: '14 + 5 = ?',
        choices: { A: '18', B: '19', C: '20', D: '21' },
        correct_answer: 'B',
        explanation: '14 + 5 = 19',
        difficulty: 'easy',
        skill_tag: 'addition_20',
      },
      {
        question_id: 'q-g1-1-7',
        lesson_id: 'l-g1-1',
        question: '7 + 8 = ?',
        choices: { A: '13', B: '14', C: '15', D: '16' },
        correct_answer: 'C',
        explanation: '7 + 8 = 15',
        difficulty: 'medium',
        skill_tag: 'addition_20',
      },
      {
        question_id: 'q-g1-1-8',
        lesson_id: 'l-g1-1',
        question: '15 + 4 = ?',
        choices: { A: '18', B: '19', C: '20', D: '21' },
        correct_answer: 'B',
        explanation: '15 + 4 = 19',
        difficulty: 'easy',
        skill_tag: 'addition_20',
      },
      {
        question_id: 'q-g1-1-9',
        lesson_id: 'l-g1-1',
        question: '6 + 9 = ?',
        choices: { A: '13', B: '14', C: '15', D: '16' },
        correct_answer: 'C',
        explanation: '6 + 9 = 15',
        difficulty: 'hard',
        skill_tag: 'addition_20',
      },
      {
        question_id: 'q-g1-1-10',
        lesson_id: 'l-g1-1',
        question: '13 + 7 = ?',
        choices: { A: '19', B: '20', C: '21', D: '22' },
        correct_answer: 'B',
        explanation: '13 + 7 = 20',
        difficulty: 'hard',
        skill_tag: 'addition_20',
      },
    ],
  },
  'l-g3-1': {
    lesson_id: 'l-g3-1',
    title: 'การคูณด้วยแบบจำลองพื้นที่',
    title_en: 'Multiplication using Area Model',
    grade: 3,
    subject: 'math',
    topic: 'area_model_multiplication',
    program_type: 'THP',
    status: 'needs_review',
    completeness_score: 90,
    quiz_count: 10,
    error_count: 1,
    updated_at: '2026-05-01T10:00:00Z',
  },
  'l-g3-2': {
    lesson_id: 'l-g3-2',
    title: 'การหารเบื้องต้น',
    title_en: 'Introduction to Division',
    grade: 3,
    subject: 'math',
    topic: 'division',
    program_type: 'THP',
    status: 'draft',
    completeness_score: 30,
    quiz_count: 0,
    error_count: 6,
    updated_at: '2026-05-02T09:00:00Z',
  },
}

// ─── Mock API functions ────────────────────────────────────────────────────────

export const mockContentApi = {
  getGrades() {
    return Promise.resolve(MOCK_GRADES)
  },

  getLessonsByGrade(grade: number): Promise<AdminContentLesson[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(MOCK_LESSONS_BY_GRADE[grade] || [])
      }, 300)
    })
  },

  getLesson(lessonId: string): Promise<AdminContentLesson | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(MOCK_FULL_LESSONS[lessonId] || null)
      }, 300)
    })
  },

  saveLesson(lessonId: string, payload: Partial<AdminContentLesson>) {
    console.log('[Mock] saveLesson', lessonId, payload)
    return Promise.resolve({ success: true, lesson_id: lessonId })
  },

  saveQuestion(lessonId: string, question: Partial<AdminContentQuestion>) {
    console.log('[Mock] saveQuestion', lessonId, question)
    const newQuestion: AdminContentQuestion = {
      question_id: `q-${Date.now()}`,
      lesson_id: lessonId,
      question: question.question || '',
      question_th: question.question_th || '',
      choices: question.choices || { A: '', B: '', C: '', D: '' },
      correct_answer: question.correct_answer || 'A',
      explanation: question.explanation || '',
      explanation_th: question.explanation_th || '',
      difficulty: question.difficulty || 'medium',
      skill_tag: question.skill_tag || '',
    }
    return Promise.resolve(newQuestion)
  },

  getQuestions(): Promise<AdminContentQuestion[]> {
    const allQuestions: AdminContentQuestion[] = []
    for (const lesson of Object.values(MOCK_FULL_LESSONS)) {
      if (lesson.quiz) {
        allQuestions.push(...lesson.quiz)
      }
    }
    return new Promise((resolve) => {
      setTimeout(() => resolve(allQuestions), 300)
    })
  },

  deleteQuestion(questionId: string) {
    console.log('[Mock] deleteQuestion', questionId)
    return Promise.resolve({ success: true })
  },

  publishLesson(lessonId: string) {
    console.log('[Mock] publishLesson', lessonId)
    return Promise.resolve({ success: true })
  },

  validateLesson(lesson: AdminContentLesson): ContentValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    const content = lesson.content_thp

    if (!content?.title_th) errors.push('Missing THP title')
    if (!content?.learning_objective_th) warnings.push('Missing THP learning objective')
    if (!content?.lesson_intro_th) warnings.push('Missing THP lesson intro')
    if (!content?.concept_explanation_th) errors.push('Missing THP concept explanation')
    if (!content?.step_by_step_th || content.step_by_step_th.length < 3)
      warnings.push('THP steps missing or less than 3')
    if (!content?.worked_examples_th || content.worked_examples_th.length < 2)
      warnings.push('THP worked examples missing or less than 2')
    if (!content?.common_mistakes_th || content.common_mistakes_th.length < 3)
      warnings.push('THP common mistakes missing or less than 3')

    const quiz = lesson.quiz || []
    if (quiz.length < 10) errors.push(`Only ${quiz.length} quiz questions (need at least 10)`)
    const noAnswer = quiz.filter((q) => !q.correct_answer)
    if (noAnswer.length > 0) errors.push(`${noAnswer.length} questions missing correct_answer`)
    const noExplanation = quiz.filter((q) => !q.explanation)
    if (noExplanation.length > 0) warnings.push(`${noExplanation.length} questions missing explanation`)

    const PLACEHOLDER_PATTERNS = [
      'ไม่มีเนื้อหา', 'ผิดที่คิด', 'ลองใช้ Model', 'TODO', 'TBD', 'placeholder',
      'lorem ipsum', 'ไม่มี', 'TBD', 'Coming soon', 'Not available',
    ]
    const contentStr = JSON.stringify(content || {})
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (contentStr.includes(pattern)) {
        errors.push(`Placeholder text found: "${pattern}"`)
        break
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  },
}

// ─── Validation ────────────────────────────────────────────────────────────────

export function validateQuizQuestion(
  q: Partial<AdminContentQuestion>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!q.question) errors.push('Question text is empty')
  if (!q.correct_answer) errors.push('Correct answer is empty')
  if (!q.explanation) errors.push('Explanation is empty')
  if (q.difficulty && !['easy', 'medium', 'hard'].includes(q.difficulty))
    errors.push('Invalid difficulty level')
  return { valid: errors.length === 0, errors }
}
