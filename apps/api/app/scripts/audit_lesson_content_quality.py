"""Audit canonical TOPA Math lesson and quiz content quality.

The checks here intentionally target the student-facing story flow:
Story -> Think Story -> Model Diagram -> Number Sentence -> Practice -> Test.
It only scans the active canonical content tree.
"""

from __future__ import annotations

import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any


CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"
THAI_RE = re.compile(r"[\u0E00-\u0E7F]")
NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?")
MOJIBAKE_MARKERS = ("Ã", "Â", "�", "à¸", "à¹", "â€™", "â€œ", "ðŸ")
GENERIC_PRACTICE_PATTERNS = (
    "ถ้าเปลี่ยนจำนวนเป็น",
    "ในเรื่องเดียวกับ",
    "คำตอบที่เหมาะสมคือข้อใด",
    "use the same story",
    "change the numbers",
)
BARE_EQUATION_RE = re.compile(r"^\s*\d+\s*[-+xX×÷*/]\s*\d+\s*(?:=|\?)?\s*$")


def load_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def walk_text(value: Any) -> list[tuple[str, str]]:
    if isinstance(value, str):
        return [("", value)]
    if isinstance(value, (int, float)):
        return [("", str(value))]
    if isinstance(value, list):
        out: list[tuple[str, str]] = []
        for item in value:
            out.extend(walk_text(item))
        return out
    if isinstance(value, dict):
        out = []
        for key, item in value.items():
            for nested_key, text in walk_text(item):
                out.append((key if not nested_key else nested_key, text))
        return out
    return []


def text_blob(value: Any) -> str:
    return "\n".join(text for _, text in walk_text(value))


def numbers_in(value: Any) -> set[str]:
    return set(NUMBER_RE.findall(text_blob(value)))


def normalize_program(payload: dict[str, Any], path: Path) -> str:
    raw = str(payload.get("program_type") or payload.get("track") or payload.get("program") or "").upper()
    if raw == "EP" or str(payload.get("lesson_id") or path.stem).lower().endswith("_ep"):
        return "EP"
    return "TH"


def get_blocks(payload: dict[str, Any]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for raw in payload.get("visual_blocks") or []:
        if isinstance(raw, dict):
            blocks.append(raw)
    for key in ("story_variants", "lesson_variants"):
        for variant in payload.get(key) or []:
            if not isinstance(variant, dict):
                continue
            for raw in variant.get("visual_blocks") or []:
                if isinstance(raw, dict):
                    blocks.append(raw)
    return blocks


def blocks_by_type(payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for block in get_blocks(payload):
        grouped.setdefault(str(block.get("type") or ""), []).append(block)
    return grouped


def block_content(block: dict[str, Any]) -> str:
    for key in ("content", "content_th", "content_en", "question", "question_th", "question_en", "expression"):
        value = block.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    data = block.get("data")
    if isinstance(data, dict):
        for key in ("content", "content_th", "content_en", "question", "question_th", "question_en", "expression"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return text_blob(block).strip()


def issue(path: Path, code: str, message: str, severity: str = "error") -> dict[str, str]:
    return {"path": str(path), "code": code, "message": message, "severity": severity}


def is_word_problem(text: str, program: str) -> bool:
    stripped = text.strip()
    if not stripped or BARE_EQUATION_RE.match(stripped):
        return False
    if len(NUMBER_RE.findall(stripped)) < 2:
        return False
    if program == "TH":
        return bool(THAI_RE.search(stripped)) and len(stripped) >= 40
    return not THAI_RE.search(stripped) and len(stripped.split()) >= 10


def check_no_mojibake(path: Path, payload: dict[str, Any]) -> list[dict[str, str]]:
    blob = text_blob(payload)
    return [
        issue(path, "mojibake", f"Found mojibake marker {marker!r}")
        for marker in MOJIBAKE_MARKERS
        if marker in blob
    ]


def check_language_keys(path: Path, payload: dict[str, Any], program: str) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    for key, text in walk_text(payload):
        if key.endswith("_en") and THAI_RE.search(text):
            issues.append(issue(path, "thai_in_en_field", f"Thai text found in {key}"))
        if program == "TH" and key in {"title", "content", "question"}:
            # Student-facing TH blocks should not be English-only headings/content.
            if text.strip() and not THAI_RE.search(text) and re.search(r"[A-Za-z]{4,}", text):
                issues.append(issue(path, "english_in_th_content", f"English-only TH content in {key}", "warning"))
    return issues


def check_lesson(path: Path, payload: dict[str, Any]) -> list[dict[str, str]]:
    program = normalize_program(payload, path)
    grouped = blocks_by_type(payload)
    issues: list[dict[str, str]] = []
    issues.extend(check_no_mojibake(path, payload))
    issues.extend(check_language_keys(path, payload, program))

    if program == "TH" and str(payload.get("lesson_id") or path.stem).lower().endswith("_ep"):
        issues.append(issue(path, "ep_content_in_th_mode", "TH lesson id ends with _ep"))

    stories = grouped.get("story_intro", [])
    thinks = grouped.get("think_story", [])
    models = grouped.get("model_diagram", [])
    sentences = grouped.get("number_sentence", [])
    practices = grouped.get("mini_quiz", [])

    if not stories:
        issues.append(issue(path, "missing_story", "Missing story_intro block"))
    if not thinks:
        issues.append(issue(path, "missing_think_story", "Missing think_story block"))
    if not models:
        issues.append(issue(path, "missing_model_diagram", "Missing model_diagram block"))
    if not sentences:
        issues.append(issue(path, "missing_number_sentence", "Missing number_sentence block"))
    if not practices:
        issues.append(issue(path, "missing_practice", "Missing mini_quiz practice block"))

    for index, story_block in enumerate(stories, start=1):
        story = block_content(story_block)
        if not is_word_problem(story, program):
            issues.append(issue(path, "weak_story", f"Story variant {index} is not a strong word problem"))
        if program == "TH" and len(story) < 180:
            issues.append(issue(path, "story_too_short", f"TH story variant {index} is shorter than expected"))

        story_numbers = numbers_in(story)
        if thinks:
            think_numbers = numbers_in(thinks[min(index - 1, len(thinks) - 1)])
            if story_numbers and not story_numbers.issubset(think_numbers):
                issues.append(issue(path, "think_story_number_mismatch", f"Think story variant {index} misses story numbers"))
        if models:
            model_numbers = numbers_in(models[min(index - 1, len(models) - 1)])
            if "0" in model_numbers:
                issues.append(issue(path, "zero_fallback_model", f"Model variant {index} contains a zero fallback"))
            if story_numbers and not story_numbers.intersection(model_numbers):
                issues.append(issue(path, "model_number_mismatch", f"Model variant {index} does not use story numbers"))
        if sentences:
            sentence_text = block_content(sentences[min(index - 1, len(sentences) - 1)])
            sentence_numbers = numbers_in(sentence_text)
            if story_numbers and not sentence_numbers.intersection(story_numbers):
                issues.append(issue(path, "number_sentence_mismatch", f"Number sentence variant {index} does not match story numbers"))
            if program == "TH" and not THAI_RE.search(sentence_text):
                issues.append(issue(path, "number_sentence_missing_unit", f"Number sentence variant {index} is missing Thai unit"))

    for index, practice in enumerate(practices, start=1):
        question = block_content(practice)
        lower = question.lower()
        if any(pattern.lower() in lower for pattern in GENERIC_PRACTICE_PATTERNS):
            issues.append(issue(path, "generic_practice", f"Practice variant {index} uses a generic template"))
        if not is_word_problem(question, program):
            issues.append(issue(path, "weak_practice", f"Practice variant {index} is not a real word problem"))
        choices = practice.get("choices") or (practice.get("data") or {}).get("choices")
        correct = practice.get("correct_answer") or practice.get("answer") or (practice.get("data") or {}).get("correct_answer")
        explanation = practice.get("explanation") or (practice.get("data") or {}).get("explanation")
        if not isinstance(choices, list) or len(choices) != 4:
            issues.append(issue(path, "practice_choices_invalid", f"Practice variant {index} must have 4 choices"))
        elif correct not in choices:
            issues.append(issue(path, "practice_answer_not_in_choices", f"Practice variant {index} answer is not in choices"))
        if not explanation:
            issues.append(issue(path, "practice_missing_explanation", f"Practice variant {index} has no explanation"))

    return issues


def check_quiz(path: Path, payload: dict[str, Any]) -> list[dict[str, str]]:
    program = normalize_program(payload, path)
    questions = payload.get("questions") or payload.get("quiz_questions") or []
    issues: list[dict[str, str]] = []
    issues.extend(check_no_mojibake(path, payload))
    issues.extend(check_language_keys(path, payload, program))
    seen: list[str] = []
    if not isinstance(questions, list) or not questions:
        return issues + [issue(path, "missing_quiz_questions", "Quiz has no questions")]
    if len(questions) < 10:
        issues.append(issue(path, "fewer_than_10_questions", "Quiz must include at least 10 questions"))
    for index, question in enumerate(questions, start=1):
        if not isinstance(question, dict):
            issues.append(issue(path, "invalid_quiz_question", f"Question {index} is not an object"))
            continue
        q_text = (
            question.get("question_text")
            or question.get("question_text_th")
            or question.get("question_text_en")
            or question.get("question_th")
            or question.get("question_en")
            or ""
        )
        if not is_word_problem(str(q_text), program):
            issues.append(issue(path, "bare_equation_quiz", f"Question {index} is not a word problem"))
        normalized = re.sub(r"\s+", " ", str(q_text).strip().lower())
        if normalized in seen:
            issues.append(issue(path, "duplicate_quiz_question", f"Question {index} duplicates an earlier question"))
        seen.append(normalized)
        choices = question.get("choices")
        correct = question.get("correct_answer") or question.get("answer")
        explanation = question.get("explanation") or question.get("explanation_th") or question.get("explanation_en")
        if not isinstance(choices, list) or len(choices) != 4:
            issues.append(issue(path, "quiz_choices_invalid", f"Question {index} must have 4 choices"))
        elif str(correct) not in [str(choice) for choice in choices]:
            issues.append(issue(path, "quiz_answer_not_in_choices", f"Question {index} answer is not in choices"))
        if not explanation:
            issues.append(issue(path, "quiz_missing_explanation", f"Question {index} has no explanation"))
    return issues


def story_duplicates(stories: list[tuple[Path, str]]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    normalized = [(path, re.sub(r"\d+", "#", re.sub(r"\s+", " ", story.strip().lower()))) for path, story in stories if story.strip()]
    for i, (path_a, story_a) in enumerate(normalized):
        for path_b, story_b in normalized[i + 1 :]:
            if path_a == path_b:
                continue
            ratio = SequenceMatcher(None, story_a, story_b).ratio()
            if ratio >= 0.70:
                issues.append(issue(path_b, "duplicate_story_template", f"Story is {ratio:.0%} similar to {path_a.name}"))
                break
    return issues


def run_audit(content_root: Path = CONTENT_ROOT) -> dict[str, Any]:
    lessons: list[dict[str, Any]] = []
    quizzes: list[dict[str, Any]] = []
    all_issues: list[dict[str, str]] = []
    stories: list[tuple[Path, str]] = []

    for lesson_path in sorted(content_root.glob("grade_*/lessons/*.json")):
        payload = load_json(lesson_path)
        if payload is None:
            issues = [issue(lesson_path, "invalid_json", "Lesson JSON could not be parsed")]
        else:
            issues = check_lesson(lesson_path, payload)
            for block in blocks_by_type(payload).get("story_intro", []):
                stories.append((lesson_path, block_content(block)))
        lessons.append({"path": str(lesson_path), "issue_count": len(issues), "issues": issues})
        all_issues.extend(issues)

    duplicate_issues = story_duplicates(stories)
    all_issues.extend(duplicate_issues)

    for quiz_path in sorted(content_root.glob("grade_*/quizzes/*.json")):
        payload = load_json(quiz_path)
        if payload is None:
            issues = [issue(quiz_path, "invalid_json", "Quiz JSON could not be parsed")]
        else:
            issues = check_quiz(quiz_path, payload)
        quizzes.append({"path": str(quiz_path), "issue_count": len(issues), "issues": issues})
        all_issues.extend(issues)

    by_code: dict[str, int] = {}
    for item in all_issues:
        by_code[item["code"]] = by_code.get(item["code"], 0) + 1
    return {
        "summary": {
            "lessons_scanned": len(lessons),
            "quizzes_scanned": len(quizzes),
            "issues": len(all_issues),
            "by_code": dict(sorted(by_code.items())),
        },
        "lessons": lessons,
        "quizzes": quizzes,
        "duplicate_story_issues": duplicate_issues,
        "issues": all_issues,
    }


def main() -> int:
    report = run_audit()
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if report["issues"]:
        for item in report["issues"][:80]:
            print(f"{item['code']}: {item['path']} - {item['message']}")
        if len(report["issues"]) > 80:
            print(f"... {len(report['issues']) - 80} more issues")
        return 1
    print("READY: lesson content quality audit passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
