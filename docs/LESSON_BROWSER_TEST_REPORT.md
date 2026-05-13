# Lesson Browser Test Report

## Summary
- Result: PARTIAL PASS
- Tested as: logged-in demo student `demo@4-craft.com`
- Web URL: http://127.0.0.1:3000
- API URL: http://127.0.0.1:8001
- Runtime status: frontend routes open without 500 or Next.js Server Error overlay

## Lesson Results
| Lesson | Opens Without 500 | Server Error Overlay | Story | Visual | Model/Diagram | Number Sentence | Mini Quiz | Choices | Thai Readability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard/lessons/g3_area_intro` | PASS | PASS - none | PASS | PASS | PASS | PASS | PASS | PASS - 4 choices | PASS - readable Thai |
| `/dashboard/lessons/g3_division_intro` | PASS | PASS - none | PASS | PASS | PASS | PASS | PASS | PASS - 4 choices | PASS - readable Thai |
| `/dashboard/lessons/g3_fractions_intro` | PASS | PASS - none | PASS | PASS | PASS | PASS | PASS | PASS - 4 choices | PASS - readable Thai |

## Blocks Rendered
| Lesson | Browser-rendered Blocks | Notes |
| --- | --- | --- |
| `g3_area_intro` | Story, visual thinking, model/diagram, number sentence, mini quiz | API block types: `story_intro`, `emoji_counter`, `area_model`, `number_sentence`, `mini_quiz`. |
| `g3_division_intro` | Story, visual thinking, model/diagram, number sentence, mini quiz | API block types: `story_intro`, `emoji_counter`, `grouping_model`, `number_sentence`, `mini_quiz`. |
| `g3_fractions_intro` | Story, visual thinking, model/diagram, number sentence, mini quiz | API block types: `story_intro`, `emoji_counter`, `fraction_visual`, `number_sentence`, `mini_quiz`. |

## Blocks Missing
| Lesson | Missing Blocks | Notes |
| --- | --- | --- |
| `g3_area_intro` | None in browser rendering | Exact source type `visual_thinking` is not used; `emoji_counter` renders as visual thinking. Exact source type `model_diagram` is not used; `area_model` renders as model/diagram. |
| `g3_division_intro` | None in browser rendering | Exact source type `visual_thinking` is not used; `emoji_counter` renders as visual thinking. Exact source type `model_diagram` is not used; `grouping_model` renders as model/diagram. |
| `g3_fractions_intro` | None in browser rendering | Exact source type `visual_thinking` is not used; `emoji_counter` renders as visual thinking. Exact source type `model_diagram` is not used; `fraction_visual` renders as model/diagram. |

## Mini Quiz Result
| Lesson | Choices Displayed | Wrong Choice Test | Correct Choice Test | Result Accuracy |
| --- | --- | --- | --- | --- |
| `g3_area_intro` | `A.7 ช่อง`, `B.12 ช่อง`, `C.43 ช่อง`, `D.34 ช่อง` | Selecting a wrong answer displays wrong feedback. | Selecting the actual correct answer `B.12 ช่อง` still displays wrong feedback. | FAIL |
| `g3_division_intro` | `A.3 ดวง`, `B.4 ดวง`, `C.6 ดวง`, `D.9 ดวง` | Selecting a wrong answer displays wrong feedback. | Selecting the actual correct answer `B.4 ดวง` still displays wrong feedback. | FAIL |
| `g3_fractions_intro` | `A.1/6`, `B.1/3`, `C.2 ชิ้น`, `D.3 ชิ้น` | Selecting a wrong answer displays wrong feedback. | Selecting the actual correct answer `C.2 ชิ้น` still displays wrong feedback. | FAIL |

## Mini Quiz Evidence
| Lesson | API Mini Quiz Data | Browser Evidence |
| --- | --- | --- |
| `g3_area_intro` | `choices: ["7 ช่อง", "12 ช่อง", "43 ช่อง", "34 ช่อง"]`, `answer: "12 ช่อง"` | Clicking `B.12 ช่อง` shows `❌ ยังไม่ถูกนะ — คำตอบที่ถูกคือ: 12 ช่อง`. |
| `g3_division_intro` | `choices: ["3 ดวง", "4 ดวง", "6 ดวง", "9 ดวง"]`, `answer: "4 ดวง"` | Clicking `B.4 ดวง` shows `❌ ยังไม่ถูกนะ — คำตอบที่ถูกคือ: 4 ดวง`. |
| `g3_fractions_intro` | `choices: ["1/6", "1/3", "2 ชิ้น", "3 ชิ้น"]`, `answer: "2 ชิ้น"` | Clicking `C.2 ชิ้น` shows `❌ ยังไม่ถูกนะ — คำตอบที่ถูกคือ: 2 ชิ้น`. |

## Thai Readability Status
| Lesson | Status | Notes |
| --- | --- | --- |
| `g3_area_intro` | PASS | Browser-rendered Thai text is readable; no mojibake detected in DOM snapshot. |
| `g3_division_intro` | PASS | Browser-rendered Thai text is readable; no mojibake detected in DOM snapshot. |
| `g3_fractions_intro` | PASS | Browser-rendered Thai text is readable; no mojibake detected in DOM snapshot. |

## Browser Console Errors
| Source | Result | Notes |
| --- | --- | --- |
| Current browser page state | PASS | No Next.js Server Error overlay on any tested lesson. |
| Direct HTTP checks | PASS | All three lesson URLs returned HTTP 200 and no `Server Error` / `Cannot find module` signatures. |
| Fresh dev log scan | PASS | No current `500`, `Cannot find module`, `Server Error`, `MiniQuiz`, `TypeError`, `ReferenceError`, `401`, or `404` entries found in the active dev logs during this test pass. |

## Findings
| Severity | Area | Issue | Evidence | Recommended Owner |
| --- | --- | --- | --- | --- |
| High | Mini quiz renderer | Correct visible answers are marked wrong when the content answer is stored as direct answer text instead of an A-D letter. | `B.12 ช่อง`, `B.4 ดวง`, and `C.2 ชิ้น` each displayed wrong feedback while also showing that same text as the correct answer. | Hermes |
| Medium | Mini quiz schema | Lesson mini quiz blocks use `data.answer` and direct answer text rather than `correct_answer`. | API mini quiz objects contain `answer` but not `correct_answer`. | OpenClaw |
| Low | Block schema consistency | Browser rendering works, but source types differ from exact requested types. | `emoji_counter`, `area_model`, `grouping_model`, and `fraction_visual` are normalized into expected visual/model sections. | Hermes / OpenClaw |

## Recommended Next Owner
| Owner | Work |
| --- | --- |
| Hermes | Fix frontend mini quiz result comparison so selecting the choice whose text matches `answer` is treated as correct. |
| OpenClaw | Normalize mini quiz content schema to include `correct_answer`, ideally as a consistent A-D key or a clearly documented answer-text format. |

## Conclusion
Lesson rendering has recovered: all three tested lessons open, render all expected learning blocks, display mini quiz choices, and show readable Thai. The remaining blocker is mini quiz correctness feedback. The UI can display choices and wrong feedback, but it marks the actual correct visible answer as wrong because the renderer compares the selected choice key against direct answer text.
