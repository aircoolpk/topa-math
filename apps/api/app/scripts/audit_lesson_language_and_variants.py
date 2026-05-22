from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"
REPO_ROOT = next((parent for parent in CONTENT_ROOT.parents if parent.name == "4-craft.com"), None)
if REPO_ROOT is None:
    REPO_ROOT = next((parent for parent in CONTENT_ROOT.parents if (parent / "apps").exists()), CONTENT_ROOT.parents[2])
REPORT_PATH = REPO_ROOT / "docs" / "LESSON_LANGUAGE_VARIANT_AUDIT_REPORT.md"

MOJIBAKE = ("ð", "YY¦", "Ã", "Â", "�")
PLACEHOLDERS = ("TODO", "placeholder", "coming soon", "Look First", "มองภาพก่อน")


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None
    return value if isinstance(value, dict) else None


def lesson_files() -> list[Path]:
    return sorted(CONTENT_ROOT.glob("grade_*/lessons/*.json"))


def lang_for(path: Path, payload: dict[str, Any]) -> str:
    if str(payload.get("program_type") or "").upper() == "EP" or path.stem.endswith("_ep"):
        return "EP"
    return "TH"


def text_blob(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return " ".join(text_blob(v) for v in value.values())
    if isinstance(value, list):
        return " ".join(text_blob(v) for v in value)
    return ""


def has_thai(text: str) -> bool:
    return any("\u0e00" <= ch <= "\u0e7f" for ch in text)


def has_english_words(text: str) -> bool:
    return bool(re.search(r"\b(Think|Story|Look|First|Use|Model|Number|Sentence|Try|Read|Circle|Multiply|There are)\b", text))


def has_mojibake(text: str) -> bool:
    return any(marker in text for marker in MOJIBAKE)


def qbank_rows(lesson_id: str, grade: int) -> list[dict[str, Any]]:
    path = CONTENT_ROOT / "question_banks" / f"grade_{grade}" / f"{lesson_id}.jsonl"
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except Exception:
            continue
        if isinstance(value, dict):
            rows.append(value)
    return rows


def validate_lesson(path: Path) -> dict[str, Any]:
    payload = read_json(path)
    if not payload:
        return {"lesson_id": path.stem, "complete": False, "issues": ["invalid_json"]}
    lesson_id = str(payload.get("lesson_id") or path.stem)
    grade = int(payload.get("grade_level") or 0)
    lang = lang_for(path, payload)
    issues: list[str] = []
    variants = payload.get("story_variants")
    if not isinstance(variants, list) or not variants:
        issues.append("missing_story_variants")
        variants = []
    approved = [v for v in variants if isinstance(v, dict) and str(v.get("status") or "approved").lower() == "approved"]
    if not approved:
        issues.append("no_approved_variant")
    all_text = text_blob(payload)
    if has_mojibake(all_text):
        issues.append("mojibake")
    if any(marker in all_text for marker in PLACEHOLDERS):
        issues.append("placeholder_or_look_first")
    for index, variant in enumerate(approved, start=1):
        prefix = f"variant_{index}"
        story = str(variant.get("story") or "")
        think = str(variant.get("think_story") or "")
        blocks = variant.get("visual_blocks") if isinstance(variant.get("visual_blocks"), list) else []
        block_types = {str(block.get("type") or block.get("block_type") or "") for block in blocks if isinstance(block, dict)}
        if lang == "TH":
            if not has_thai(story) or has_english_words(story):
                issues.append(f"{prefix}_language_mismatch_th")
            if len(story) < 300:
                issues.append(f"{prefix}_story_too_short_th")
        else:
            if has_thai(story) or len(story.split()) < 60:
                issues.append(f"{prefix}_language_mismatch_or_short_ep")
        for required in ("story_intro", "think_story", "model_diagram", "number_sentence", "mini_quiz"):
            if required not in block_types:
                issues.append(f"{prefix}_missing_{required}")
        if "visual_thinking" in block_types:
            issues.append(f"{prefix}_contains_look_first")
        if not think:
            issues.append(f"{prefix}_missing_think_story")
    rows = qbank_rows(lesson_id, grade)
    if len(rows) < 10:
        issues.append("test_bank_under_10")
    for row in rows[:10]:
        question = str(row.get("question_text_th") if lang == "TH" else row.get("question_text_en") or "")
        choices = row.get("choices")
        answer = str(row.get("correct_answer") or "")
        if lang == "TH":
            if not has_thai(question):
                issues.append("test_language_mismatch_th")
                break
            if len(question) < 40:
                issues.append("test_question_too_short_th")
                break
        else:
            if has_thai(question) or len(question.split()) < 12:
                issues.append("test_language_mismatch_or_short_ep")
                break
        if not isinstance(choices, list) or answer not in [str(choice) for choice in choices]:
            issues.append("test_answer_not_in_choices")
            break
    return {"lesson_id": lesson_id, "language": lang, "grade_level": grade, "complete": not issues, "issues": sorted(set(issues))}


def main() -> None:
    results = [validate_lesson(path) for path in lesson_files()]
    broken = [row for row in results if not row["complete"]]
    summary = {
        "total_lessons": len(results),
        "complete_lessons": len(results) - len(broken),
        "broken_lessons": len(broken),
        "th_lessons": sum(1 for row in results if row["language"] == "TH"),
        "ep_lessons": sum(1 for row in results if row["language"] == "EP"),
        "blocking_examples": broken[:30],
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        "# Lesson Language And Variant Audit\n\n"
        f"- Total lessons: {summary['total_lessons']}\n"
        f"- Complete lessons: {summary['complete_lessons']}\n"
        f"- Broken lessons: {summary['broken_lessons']}\n"
        f"- TH lessons: {summary['th_lessons']}\n"
        f"- EP lessons: {summary['ep_lessons']}\n\n"
        "## Blocking Examples\n\n"
        + "\n".join(f"- {row['lesson_id']}: {', '.join(row['issues'])}" for row in broken[:50])
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({**summary, "report": str(REPORT_PATH)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
