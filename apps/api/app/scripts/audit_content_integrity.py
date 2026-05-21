from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"


def repo_docs_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / ".git").exists():
            return parent / "docs"
    for parent in current.parents:
        if parent.name == "4-craft.com":
            return parent / "docs"
    for parent in reversed(current.parents):
        candidate = parent / "docs"
        if candidate.exists():
            return candidate
    return Path.cwd() / "docs"


DOCS_ROOT = repo_docs_root()
REPORT_PATH = DOCS_ROOT / "CONTENT_INTEGRITY_AUDIT_REPORT.md"

MOJIBAKE_MARKERS = ("ð", "�", "YY¦", "Ã", "Â", "Ð", "à¸", "à¹", "âœ", "ï¿½")
PLACEHOLDER_MARKERS = ("todo", "placeholder", "coming soon", "lorem", "มีของหลายชิ้นต้องแบ่ง")
MODEL_TYPES = {
    "model_diagram",
    "bar_model",
    "number_bond",
    "part_whole_model",
    "place_value_chart",
    "ten_frame",
    "area_model",
    "array_model",
    "shape_visual",
    "fraction_visual",
    "graph_visual",
    "volume_visual",
    "table_visual",
    "count_back_strip",
    "multi_step_model",
}


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None
    return value if isinstance(value, dict) else None


def lesson_files() -> list[Path]:
    return sorted(CONTENT_ROOT.glob("grade_*/lessons/*.json"))


def question_files() -> list[Path]:
    return sorted(CONTENT_ROOT.glob("question_banks/grade_*/*.jsonl"))


def grade_from_path(path: Path) -> int:
    match = re.search(r"grade_(\d+)", str(path))
    return int(match.group(1)) if match else 0


def language_for_lesson(payload: dict[str, Any], path: Path) -> str:
    raw = str(payload.get("program_type") or payload.get("content_program_type") or payload.get("track") or "").upper()
    if raw in {"EP", "EN", "ENGLISH"} or path.stem.lower().endswith("_ep"):
        return "EP"
    return "TH"


def base_lesson_id(lesson_id: str) -> str:
    for suffix in ("_ep", "_thp", "_th"):
        if lesson_id.lower().endswith(suffix):
            return lesson_id[: -len(suffix)]
    return lesson_id


def text_blob(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def has_mojibake(value: Any) -> bool:
    blob = text_blob(value)
    return any(marker in blob for marker in MOJIBAKE_MARKERS)


def has_placeholder(value: Any) -> bool:
    blob = text_blob(value).lower()
    return any(marker.lower() in blob for marker in PLACEHOLDER_MARKERS)


def parse_json_like(value: Any) -> Any:
    if isinstance(value, str):
        text = value.strip()
        if text.startswith(("{", "[")):
            try:
                return json.loads(text)
            except Exception:
                return value
    return value


def block_type(block: Any) -> str:
    block = parse_json_like(block)
    if not isinstance(block, dict):
        return ""
    return str(block.get("type") or block.get("block_type") or "").strip()


def block_data(block: Any) -> dict[str, Any]:
    block = parse_json_like(block)
    if not isinstance(block, dict):
        return {}
    raw = parse_json_like(block.get("data"))
    data = dict(raw) if isinstance(raw, dict) else {}
    for key, value in block.items():
        if key not in {"type", "block_type", "data"}:
            data.setdefault(str(key), value)
    return data


def lesson_visual_blocks(payload: dict[str, Any]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    raw_top = parse_json_like(payload.get("visual_blocks"))
    if isinstance(raw_top, list):
        blocks.extend([item for item in raw_top if isinstance(parse_json_like(item), dict)])
    variants = payload.get("lesson_variants")
    if isinstance(variants, list):
        for variant in variants:
            if not isinstance(variant, dict):
                continue
            raw = parse_json_like(variant.get("visual_blocks"))
            if isinstance(raw, list):
                blocks.extend([item for item in raw if isinstance(parse_json_like(item), dict)])
    return blocks


def normalize_choice(value: Any) -> str:
    text = str(value or "").strip()
    text = re.sub(r"^[A-D][\:\.\)]\s*", "", text, flags=re.I).strip()
    return text


def normalize_answer(value: Any, choices: list[Any]) -> str:
    answer = str(value or "").strip()
    letter = answer.upper()
    if letter in {"A", "B", "C", "D"}:
        idx = ord(letter) - ord("A")
        if idx < len(choices):
            return normalize_choice(choices[idx])
    return normalize_choice(answer)


def question_text(question: dict[str, Any]) -> str:
    return str(
        question.get("question")
        or question.get("question_text")
        or question.get("question_text_th")
        or question.get("question_text_en")
        or question.get("question_en")
        or ""
    ).strip()


def explanation_text(question: dict[str, Any]) -> str:
    return str(question.get("explanation") or question.get("explanation_th") or question.get("explanation_en") or "").strip()


def validate_lesson(path: Path) -> dict[str, Any]:
    payload = read_json(path)
    if not payload:
        return {"lesson_id": path.stem, "path": str(path), "grade_level": grade_from_path(path), "language": "unknown", "complete": False, "issues": ["invalid_json"]}

    lesson_id = str(payload.get("lesson_id") or payload.get("id") or path.stem).strip()
    grade = payload.get("grade_level") or grade_from_path(path)
    language = language_for_lesson(payload, path)
    issues: list[str] = []

    try:
        grade_int = int(grade)
    except Exception:
        grade_int = 0
    if not lesson_id:
        issues.append("missing_lesson_id")
    if grade_int not in range(1, 7):
        issues.append("invalid_grade_level")
    if language not in {"TH", "EP"}:
        issues.append("invalid_language")
    if not str(payload.get("title_th") or payload.get("title_en") or payload.get("title") or "").strip():
        issues.append("missing_title")
    if not str(payload.get("story_intro_th") or payload.get("story_intro") or payload.get("objective_th") or payload.get("objective_en") or "").strip():
        issues.append("missing_story_or_objective")
    if has_mojibake(payload):
        issues.append("mojibake_detected")
    if has_placeholder(payload):
        issues.append("placeholder_detected")

    blocks = lesson_visual_blocks(payload)
    if not blocks:
        issues.append("missing_visual_blocks")
    types = [block_type(block) for block in blocks]
    if not any(kind == "story_intro" for kind in types):
        issues.append("missing_story_block")
    if not any(kind in {"visual_thinking", "emoji_counter"} for kind in types):
        issues.append("missing_visual_thinking")
    if not any(kind in MODEL_TYPES for kind in types):
        issues.append("missing_model_diagram")
    if not any(kind in {"number_sentence", "equation", "expression"} for kind in types):
        issues.append("missing_number_sentence")
    if not any(kind == "mini_quiz" for kind in types):
        issues.append("missing_practice_mini_quiz")

    for index, block in enumerate(blocks):
        data = block_data(block)
        if has_mojibake(data):
            issues.append(f"block_{index}_mojibake")
        joined = text_blob(data)
        if re.search(r"\b(before|after|ก่อน|หลังจาก)\b[^0-9]{0,20}0\b", joined, flags=re.I) and "0" not in str(payload.get("title_th") or ""):
            issues.append(f"block_{index}_zero_fallback_risk")

    return {
        "lesson_id": lesson_id,
        "base_lesson_id": base_lesson_id(lesson_id),
        "path": str(path),
        "grade_level": grade_int,
        "language": language,
        "complete": not issues,
        "issues": sorted(set(issues)),
    }


def load_questions(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8-sig").splitlines()
    except OSError:
        return rows
    for line in lines:
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except Exception:
            rows.append({"__invalid_json__": line})
            continue
        rows.append(value if isinstance(value, dict) else {"__invalid_json__": line})
    return rows


def validate_question(row: dict[str, Any], path: Path, index: int) -> list[str]:
    issues: list[str] = []
    if "__invalid_json__" in row:
        return ["invalid_json"]
    qid = str(row.get("question_id") or row.get("id") or "").strip()
    if not qid:
        issues.append("missing_question_id")
    if not question_text(row):
        issues.append("missing_question_text")
    choices = row.get("choices")
    if not isinstance(choices, list) or len(choices) < 4:
        issues.append("missing_or_short_choices")
        choices = choices if isinstance(choices, list) else []
    normalized_choices = [normalize_choice(choice) for choice in choices]
    if len(normalized_choices) != len(set(normalized_choices)):
        issues.append("duplicate_choices")
    answer = normalize_answer(row.get("correct_answer") or row.get("answer"), choices)
    if not answer:
        issues.append("missing_correct_answer")
    elif answer not in normalized_choices:
        issues.append("correct_answer_not_in_choices")
    if not explanation_text(row):
        issues.append("missing_explanation")
    if has_mojibake(row):
        issues.append("mojibake_detected")
    if has_placeholder(row):
        issues.append("placeholder_detected")
    return sorted(set(issues))


def validate_test_file(path: Path) -> dict[str, Any]:
    rows = load_questions(path)
    lesson_id = path.stem
    grade = grade_from_path(path)
    issues_by_question: dict[str, list[str]] = {}
    for index, row in enumerate(rows, start=1):
        qid = str(row.get("question_id") or row.get("id") or f"{lesson_id}_row_{index}") if isinstance(row, dict) else f"{lesson_id}_row_{index}"
        issues = validate_question(row, path, index)
        if issues:
            issues_by_question[qid] = issues
    file_issues: list[str] = []
    if len(rows) < 5:
        file_issues.append("less_than_5_questions")
    elif len(rows) < 10:
        file_issues.append("less_than_10_questions")
    return {
        "lesson_id": lesson_id,
        "base_lesson_id": base_lesson_id(lesson_id),
        "path": str(path),
        "grade_level": grade,
        "question_count": len(rows),
        "complete": not file_issues and not issues_by_question,
        "issues": file_issues,
        "issues_by_question": issues_by_question,
    }


def build_audit() -> dict[str, Any]:
    lesson_items = [validate_lesson(path) for path in lesson_files()]
    test_items = [validate_test_file(path) for path in question_files()]
    tests_by_lesson = {item["lesson_id"]: item for item in test_items}

    missing_tests = []
    mismatched_tests = []
    visible_without_approved_test = []
    ep_missing = []
    bases_by_grade: dict[tuple[int, str], set[str]] = {}
    for item in lesson_items:
        bases_by_grade.setdefault((item["grade_level"], item["language"]), set()).add(item["base_lesson_id"])
        if item["language"] == "TH" and item["lesson_id"] not in tests_by_lesson:
            missing_tests.append(item["lesson_id"])
        if item["complete"] and item["lesson_id"] not in tests_by_lesson:
            visible_without_approved_test.append(item["lesson_id"])
    for item in test_items:
        if item["lesson_id"] not in {lesson["lesson_id"] for lesson in lesson_items}:
            mismatched_tests.append(item["lesson_id"])
    for grade in range(1, 7):
        th = bases_by_grade.get((grade, "TH"), set())
        ep = bases_by_grade.get((grade, "EP"), set())
        ep_missing.extend(sorted(f"g{grade}:{lesson_id}" for lesson_id in th - ep))

    broken_lessons = [item for item in lesson_items if not item["complete"]]
    broken_tests = [item for item in test_items if not item["complete"]]
    return {
        "content_model": {
            "lessons": "JSON files under apps/api/app/content/math/grade_*/lessons plus sidecar status metadata",
            "tests": "JSONL files under apps/api/app/content/math/question_banks/grade_* plus sidecar status metadata",
            "pairing_field": "question_bank filename and row.lesson_id must match lesson.lesson_id",
            "status_metadata": "apps/api/app/content/math/_content_status/lessons.json and tests.json",
        },
        "total_lessons": len(lesson_items),
        "complete_lessons": len(lesson_items) - len(broken_lessons),
        "broken_lessons": len(broken_lessons),
        "total_tests": len(test_items),
        "matched_tests": len(test_items) - len(mismatched_tests),
        "missing_tests": len(missing_tests),
        "broken_tests": len(broken_tests),
        "ep_missing": len(ep_missing),
        "lessons": lesson_items,
        "tests": test_items,
        "missing_test_lesson_ids": sorted(missing_tests),
        "test_lesson_id_mismatches": sorted(mismatched_tests),
        "visible_without_test": sorted(visible_without_approved_test),
        "ep_missing_base_lessons": ep_missing,
    }


def write_report(audit: dict[str, Any], path: Path = REPORT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    broken_lessons = [item for item in audit["lessons"] if not item["complete"]]
    broken_tests = [item for item in audit["tests"] if not item["complete"]]
    lines = [
        "# TOPA Math Content Integrity Audit",
        "",
        "## Storage Model",
        f"- Lessons: {audit['content_model']['lessons']}",
        f"- Tests: {audit['content_model']['tests']}",
        f"- Pairing field: {audit['content_model']['pairing_field']}",
        f"- Status metadata: {audit['content_model']['status_metadata']}",
        "",
        "## Summary",
        f"- Total lessons: {audit['total_lessons']}",
        f"- Complete lessons: {audit['complete_lessons']}",
        f"- Broken lessons: {audit['broken_lessons']}",
        f"- Total test files: {audit['total_tests']}",
        f"- Matched test files: {audit['matched_tests']}",
        f"- Missing test files: {audit['missing_tests']}",
        f"- Broken test files: {audit['broken_tests']}",
        f"- EP missing base lessons: {audit['ep_missing']}",
        "",
        "## Blocking Lesson Issues",
    ]
    for item in broken_lessons[:80]:
        lines.append(f"- `{item['lesson_id']}` g{item['grade_level']} {item['language']}: {', '.join(item['issues'])}")
    if len(broken_lessons) > 80:
        lines.append(f"- ... {len(broken_lessons) - 80} more")
    lines.extend(["", "## Blocking Test Issues"])
    for item in broken_tests[:80]:
        question_issue_count = len(item["issues_by_question"])
        issue_bits = list(item["issues"])
        if question_issue_count:
            issue_bits.append(f"{question_issue_count} question rows invalid")
        lines.append(f"- `{item['lesson_id']}` g{item['grade_level']}: {', '.join(issue_bits)}")
    if len(broken_tests) > 80:
        lines.append(f"- ... {len(broken_tests) - 80} more")
    lines.extend(["", "## Missing Pairings"])
    for lesson_id in audit["missing_test_lesson_ids"][:120]:
        lines.append(f"- `{lesson_id}`")
    lines.extend(["", "## Recommended Fixes"])
    lines.extend(
        [
            "- Generate or repair one approved question bank per student-visible lesson_id.",
            "- Seed test status per question_id after validation, preserving existing admin decisions unless --force is used.",
            "- Let student test start check approved question_banks in addition to embedded lesson quizzes.",
            "- Hide or mark needs_review for lessons with mojibake, missing visual blocks, missing number sentences, or no practice quiz.",
            "- Create EP lesson/test files for every approved TH base lesson before EP users see the content.",
        ]
    )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit TOPA Math lesson/test content integrity.")
    parser.add_argument("--json", action="store_true", help="Print full JSON audit instead of compact summary.")
    parser.add_argument("--report", default=str(REPORT_PATH), help="Markdown report path.")
    args = parser.parse_args()
    audit = build_audit()
    write_report(audit, Path(args.report))
    if args.json:
        print(json.dumps(audit, ensure_ascii=False, indent=2))
    else:
        print(
            json.dumps(
                {
                    "total_lessons": audit["total_lessons"],
                    "complete_lessons": audit["complete_lessons"],
                    "broken_lessons": audit["broken_lessons"],
                    "total_tests": audit["total_tests"],
                    "missing_tests": audit["missing_tests"],
                    "broken_tests": audit["broken_tests"],
                    "ep_missing": audit["ep_missing"],
                    "report": str(Path(args.report)),
                },
                ensure_ascii=False,
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
