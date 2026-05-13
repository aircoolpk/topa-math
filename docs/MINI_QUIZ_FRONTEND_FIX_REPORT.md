# MINI_QUIZ_FRONTEND_FIX_REPORT

Date: 2026-05-12
Project: 4-Craft Adaptive Learning SaaS
Component: Frontend lesson renderer — mini_quiz answer comparison

---

## Root Cause

The bug was in `BlockMiniQuiz` answer comparison logic. When a user clicked a choice button:

- `handleSelect(choiceKey)` stored the letter key e.g. `'B'` in `selected` state
- `getMiniQuizCorrectAnswer(block)` returned the full displayed choice text e.g. `'12 ช่อง'`, NOT a letter
- `answersMatch('B', '12 ช่อง', choices)` compared `'B'` directly against `'12 ช่อง'` → always false → always wrong feedback

The correct answer in all three lessons is stored as the full choice label in the `correct_answer` field of the mini_quiz block — not a letter index.

**Data shape from backend JSON** (`g3_area_intro` variant v01):
```json
{
  "type": "mini_quiz",
  "title": "🎯 ลองทำดู",
  "question": "พื้นที่กว้าง 4 ช่อง สูง 3 ช่อง มีกี่ช่อง?",
  "choices": ["7 ช่อง", "12 ช่อง", "43 ช่อง", "34 ช่อง"],
  "answer": "12 ช่อง",
  "correct_answer": "12 ช่อง"
}
```

Same pattern confirmed for `g3_division_intro` (`answer: '4 ดวง'`) and `g3_fractions_intro` (`answer: '2 ชิ้น'`).

---

## Fix Applied

### 1. `normalizeAnswerText(val)` — lines 97–114

Strips prefixes, normalizes whitespace, converts Thai digits:
- Removes leading `A.` / `B.` / `C.` / `D.` (English) and `ก.` / `ข.` / `ค.` / `ง.` (Thai)
- Collapses multiple spaces
- Converts ๐๑๒๓๔๕๖๗๘๙ → 0123456789

### 2. `resolveChoiceAnswer(answer, choices)` — lines 116–139

Converts abstract answer representations to actual choice text:
- `'B'` (bare letter) → `choices[1]` e.g. `'4 ดวง'`
- `'0'`-`'3'` (0-based index) → `choices[n]`
- `'1'`-`'4'` (1-based index, only when not a real choice value) → `choices[n-1]`
- Otherwise returns the answer as-is

### 3. `answersMatch(selected, correct, choices)` — lines 141–145

Resolves both sides through `resolveChoiceAnswer` before comparing normalized text:
```typescript
function answersMatch(selected: string, correct: string, choices: string[]): boolean {
  const resolvedSelected = resolveChoiceAnswer(selected, choices)
  const resolvedCorrect = resolveChoiceAnswer(correct, choices)
  return normalizeAnswerText(resolvedSelected) === normalizeAnswerText(resolvedCorrect)
}
```

### 4. Call sites updated (2 places)

**Line 605** — button background color (green for correct, red for wrong):
```typescript
const isCorrectOption = answersMatch(choiceKey, correctAnswerLetter, choices)
```

**Line 633** — feedback banner (✅ correct / ❌ wrong):
```typescript
{answersMatch(selected ?? '', correctAnswerLetter, choices) ? (
```

---

## How Fix Resolves Each Broken Lesson

### g3_area_intro — click "B.12 ช่อง"

| Step | Value |
|------|-------|
| `selected` | `'B'` |
| `correctAnswerRaw` | `'12 ช่อง'` |
| `resolveChoiceAnswer('B', choices)` | → `choices[1]` = `'12 ช่อง'` |
| `resolveChoiceAnswer('12 ช่อง', choices)` | → `'12 ช่อง'` (no pattern) |
| `normalizeAnswerText('12 ช่อง')` | = `'12 ช่อง'` |
| Comparison | `'12 ช่อง'` === `'12 ช่อง'` → **true** ✅ |

### g3_division_intro — click "B.4 ดวง"

| Step | Value |
|------|-------|
| `selected` | `'B'` |
| `correctAnswerRaw` | `'4 ดวง'` |
| `resolveChoiceAnswer('B', choices)` | → `choices[1]` = `'4 ดวง'` |
| `resolveChoiceAnswer('4 ดวง', choices)` | → `'4 ดวง'` (no pattern) |
| `normalizeAnswerText('4 ดวง')` | = `'4 ดวง'` |
| Comparison | `'4 ดวง'` === `'4 ดวง'` → **true** ✅ |

### g3_fractions_intro — click "C.2 ชิ้น"

| Step | Value |
|------|-------|
| `selected` | `'C'` |
| `correctAnswerRaw` | `'2 ชิ้น'` |
| `resolveChoiceAnswer('C', choices)` | → `choices[2]` = `'2 ชิ้น'` |
| `resolveChoiceAnswer('2 ชิ้น', choices)` | → `'2 ชิ้น'` (no pattern) |
| `normalizeAnswerText('2 ชิ้น')` | = `'2 ชิ้น'` |
| Comparison | `'2 ชิ้น'` === `'2 ชิ้น'` → **true** ✅ |

### Wrong choice still shows red

Clicking "A.7 ช่อง" in g3_area_intro:
- `resolveChoiceAnswer('A', choices)` → `'7 ช่อง'`
- `resolveChoiceAnswer('12 ช่อง', choices)` → `'12 ช่อง'`
- `'7 ช่อง'` !== `'12 ช่อง'` → **false** → red wrong feedback ✅

---

## File Changed

- `src/app/dashboard/lessons/[lessonId]/page.tsx`

Helpers added: `normalizeAnswerText`, `resolveChoiceAnswer`, `answersMatch`
Call sites updated: line 605, line 633

---

## Build Result

```
cd /mnt/d/web app/4-craft.com/apps/web
npm run lint    → exit 0 ✅
npm run build   → exit 0 ✅
  /dashboard/lessons/[lessonId]  7.51 kB  127 kB JS
  22 pages generated, 0 missing chunk errors
```

---

## Manual Browser Test Checklist

Test requires login: `demo@4-craft.com` / `demo1234`

### Correct answer → green feedback expected

| Lesson | URL | Click | Expected |
|--------|-----|-------|----------|
| g3_area_intro | `/dashboard/lessons/g3_area_intro` | "B.12 ช่อง" | ✅ Green "ถูกต้อง เก่งมาก!" |
| g3_division_intro | `/dashboard/lessons/g3_division_intro` | "B.4 ดวง" | ✅ Green "ถูกต้อง เก่งมาก!" |
| g3_fractions_intro | `/dashboard/lessons/g3_fractions_intro` | "C.2 ชิ้น" | ✅ Green "ถูกต้อง เก่งมาก!" |

### Wrong answer → red feedback still works

| Lesson | Click wrong | Expected |
|--------|-------------|----------|
| g3_area_intro | "A.7 ช่อง" | ❌ Red "ยังไม่ถูกนะ — คำตอบที่ถูกคือ: 12 ช่อง" |
| g3_division_intro | "A.3 ดวง" | ❌ Red "ยังไม่ถูกนะ — คำตอบที่ถูกคือ: 4 ดวง" |
| g3_fractions_intro | "A.1/6" | ❌ Red "ยังไม่ถูกนะ — คำตอบที่ถูกคือ: 2 ชิ้น" |

### Retry button
- After wrong answer, "🔄 ลองใหม่" button should reset the quiz ✅

---

## Before/After

| Scenario | Before (broken) | After (fixed) |
|----------|-----------------|---------------|
| g3_area_intro → "B.12 ช่อง" | ❌ "ยังไม่ถูกนะ" | ✅ "ถูกต้อง เก่งมาก!" |
| g3_division_intro → "B.4 ดวง" | ❌ "ยังไม่ถูกนะ" | ✅ "ถูกต้อง เก่งมาก!" |
| g3_fractions_intro → "C.2 ชิ้น" | ❌ "ยังไม่ถูกนะ" | ✅ "ถูกต้อง เก่งมาก!" |
| Wrong choices | ✅ Red wrong (correct) | ✅ Red wrong (unchanged) |

---

## Remaining Blockers

1. **Browser testing unavailable** in this WSL environment (Chrome/Playwright fails with `libnspr4.so`). Manual browser verification required.
2. **Backend not running** — port 8001 occupied. Auth-protected routes return HTTP 401; the lesson content is served by the dev server but live API calls (startLesson, etc.) will fail until backend is running.

---

## Not Touched (per constraints)

- No lesson content JSON files edited
- No Stripe code touched
- No backend touched
- No new features added
- Only the lesson renderer comparison logic updated