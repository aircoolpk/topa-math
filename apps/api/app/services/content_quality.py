import json
import re
from pathlib import Path
from typing import Any


SINGAPORE_MODELS = {
    "number_bond",
    "number bond",
    "bar_model",
    "bar model",
    "ten_frame",
    "ten frame",
    "area_model",
    "area model",
    "part_whole_model",
    "part-whole model",
    "part whole model",
    "array_model",
    "array model",
    "place_value_chart",
    "place value chart",
}

PLACEHOLDER_TEXT = {
    "\u00e0\u00b8",
    "\u00e0\u00b9",
    "\u00e2\u0153",
    "\u00f0\u0178",
    "\u00c3",
    "\u00c2",
    "\ufffd\ufffd",
    "\u0e44\u0e21\u0e48\u0e21\u0e35\u0e40\u0e19\u0e37\u0e49\u0e2d\u0e2b\u0e32",
    "\u0e1c\u0e34\u0e14\u0e17\u0e35\u0e48\u0e04\u0e34\u0e14",
    "\u0e25\u0e2d\u0e07\u0e43\u0e0a\u0e49 Model",
    "TO" + "DO",
    "T" + "BD",
    "place" + "holder",
    "lorem" + " ipsum",
}

INAPPROPRIATE_WORDS = {
    "โง่",
    "บ้า",
    "ควาย",
    "stupid",
    "idiot",
    "dumb",
}

AMBIGUOUS_WORDS = {
    "อาจจะ",
    "น่าจะ",
    "ประมาณ",
    "maybe",
    "somehow",
    "roughly",
}

DIFFICULT_ENGLISH_WORDS = {
    "consequently",
    "nevertheless",
    "approximately",
    "utilize",
    "subsequently",
    "therefore",
}

# Mojibake / garbled text markers
GARBLED_MARKERS = {
    "\ufffd",
    "ð",
    "YY¦",
    "Ã©",
    "Ã¨",
    "â",
    "â€™",
    "â€œ",
    "â€",
}

CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"


def _issue(code: str, message: str, severity: str = "error") -> dict[str, str]:
    return {"code": code, "message": message, "severity": severity}


def _walk_text(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        texts: list[str] = []
        for nested in value.values():
            texts.extend(_walk_text(nested))
        return texts
    if isinstance(value, list):
        texts = []
        for nested in value:
            texts.extend(_walk_text(nested))
        return texts
    return []


def _has_text(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return bool(value)
    if isinstance(value, dict):
        return bool(value)
    return value is not None


def lesson_program_type(payload: dict[str, Any]) -> str:
    raw = payload.get("program_type") or payload.get("track") or payload.get("content_program_type") or "THP"
    normalized = str(raw).upper()
    if normalized in {"TH", "THAI"}:
        return "THP"
    return "EP" if normalized == "EP" else "THP"


def lesson_is_student_visible(payload: dict[str, Any], quiz_payload: dict[str, Any] | None = None) -> bool:
    if str(payload.get("status") or "approved").lower() not in {"approved", "published"}:
        return False
    if payload.get("quality_required") is True or payload.get("content_schema_version") == "2.0":
        return validate_lesson_payload(payload, quiz_payload=quiz_payload)["publishable"]
    return True


def _visual_blocks(payload: dict[str, Any]) -> list[Any]:
    blocks: list[Any] = []
    raw_blocks = payload.get("visual_blocks")
    if isinstance(raw_blocks, list):
        blocks.extend(raw_blocks)
    elif raw_blocks:
        blocks.append(raw_blocks)
    for variant in payload.get("lesson_variants") or []:
        if not isinstance(variant, dict):
            continue
        raw_variant_blocks = variant.get("visual_blocks")
        if isinstance(raw_variant_blocks, list):
            blocks.extend(raw_variant_blocks)
        elif raw_variant_blocks:
            blocks.append(raw_variant_blocks)
    model = payload.get("singapore_math_model")
    if model:
        blocks.append(model)
    return blocks


def _contains_singapore_model(payload: dict[str, Any]) -> bool:
    texts = [text.lower() for text in _walk_text(_visual_blocks(payload))]
    texts.extend(
        str(payload.get(key, "")).lower()
        for key in (
            "model_type",
            "singapore_math_model",
            "visual_model_prompt",
            "visual_model_prompt_th",
        )
    )
    return any(model in text for model in SINGAPORE_MODELS for text in texts)


def _has_visual_model(payload: dict[str, Any]) -> bool:
    return bool(
        _visual_blocks(payload)
        or payload.get("diagram")
        or payload.get("diagram_data")
        or payload.get("visual_model_prompt")
        or payload.get("visual_model_prompt_th")
    )


def _quiz_questions(quiz_payload: dict[str, Any] | None, payload: dict[str, Any]) -> list[dict[str, Any]]:
    question_sets: list[list[Any]] = []
    if isinstance(quiz_payload, dict):
        question_sets.extend(
            [
                quiz_payload.get("questions") or [],
                quiz_payload.get("quiz_questions") or [],
                quiz_payload.get("quiz_th") or [],
            ]
        )
    question_sets.extend(
        [
            payload.get("questions") or [],
            payload.get("quiz_questions") or [],
            payload.get("quiz_th") or [],
        ]
    )
    normalized_sets = [[question for question in questions if isinstance(question, dict)] for questions in question_sets]
    return max(normalized_sets, key=len, default=[])


def _numeric_answer(value: Any) -> int | None:
    text = str(value or "").strip()
    match = re.search(r"-?\d+", text)
    return int(match.group(0)) if match else None


def _check_simple_multiplication(question: dict[str, Any]) -> bool | None:
    text = " ".join(_walk_text({k: question.get(k) for k in ("question_text", "question_text_th", "question_text_en", "question_th", "question_en")}))
    match = re.search(r"(\d+)\s*(?:x|\*|×)\s*(\d+)", text, flags=re.IGNORECASE)
    if not match:
        return None
    expected = int(match.group(1)) * int(match.group(2))
    actual = _numeric_answer(question.get("correct_answer") or question.get("answer"))
    return actual == expected if actual is not None else False


def _validate_text_quality(payload: dict[str, Any], program_type: str) -> list[dict[str, str]]:
    text_blob = "\n".join(_walk_text(payload))
    issues: list[dict[str, str]] = []
    for marker in PLACEHOLDER_TEXT:
        if marker.lower() in text_blob.lower():
            issues.append(_issue("placeholder_text", f"Found placeholder text: {marker}"))
    for word in INAPPROPRIATE_WORDS:
        if _contains_standalone_word(text_blob, word):
            issues.append(_issue("inappropriate_language", f"Found inappropriate word: {word}"))
    for word in AMBIGUOUS_WORDS:
        if _contains_standalone_word(text_blob, word):
            issues.append(_issue("ambiguous_wording", f"Found ambiguous wording: {word}", "warning"))
    for marker in GARBLED_MARKERS:
        if marker in text_blob:
            issues.append(_issue("garbled_text", f"Found garbled/mojibake text marker: {repr(marker)}"))
    if program_type == "EP":
        lower_text = text_blob.lower()
        for word in DIFFICULT_ENGLISH_WORDS:
            if re.search(rf"\b{re.escape(word)}\b", lower_text):
                issues.append(_issue("overly_difficult_english", f"English word may be too difficult: {word}", "warning"))
    return issues


def _contains_standalone_word(text: str, word: str) -> bool:
    if word.isascii():
        return bool(re.search(rf"\b{re.escape(word)}\b", text, flags=re.IGNORECASE))
    return bool(re.search(rf"(?<![ก-๙A-Za-z]){re.escape(word)}(?![ก-๙A-Za-z])", text))


def validate_lesson_payload(payload: dict[str, Any], quiz_payload: dict[str, Any] | None = None) -> dict[str, Any]:
    program_type = lesson_program_type(payload)
    issues: list[dict[str, str]] = []

    # Basic field requirements
    for field in ("lesson_id", "grade_level"):
        if not _has_text(payload.get(field)):
            issues.append(_issue("empty_required_field", f"Missing required field: {field}"))

    # title_th or title_en must exist
    if not _has_text(payload.get("title_th")) and not _has_text(payload.get("title_en")):
        issues.append(_issue("empty_required_field", "Either title_th or title_en must be present"))

    # grade_level must be 1-6
    try:
        grade = int(payload.get("grade_level") or 0)
        if grade < 1 or grade > 6:
            issues.append(_issue("invalid_grade_level", "grade_level must be between 1 and 6"))
    except (TypeError, ValueError):
        issues.append(_issue("invalid_grade_level", "grade_level must be a number between 1 and 6"))

    # program_type must be THP or EP
    if program_type not in {"THP", "EP"}:
        issues.append(_issue("invalid_program_type", "program_type must be THP or EP"))

    if not _has_text(payload.get("topic_code") or payload.get("skill_code")):
        issues.append(_issue("empty_required_field", "Missing required field: topic_code or skill_code"))

    if program_type == "THP":
        for field in ("story_intro_th", "explanation_steps", "worked_examples", "common_mistakes"):
            if not _has_text(payload.get(field)):
                issues.append(_issue("missing_thp_content", f"THP lesson is missing: {field}"))
    else:
        for field in ("title_en", "objective_en", "explanation_en", "explanation_th", "vocabulary"):
            if not _has_text(payload.get(field)):
                issues.append(_issue("missing_ep_content", f"EP lesson is missing: {field}"))

    if not _contains_singapore_model(payload):
        issues.append(_issue("missing_singapore_math_model", "Lesson must include a Singapore Math model."))
    if not _has_visual_model(payload):
        issues.append(_issue("missing_diagram", "Lesson must include diagram data or a visual model prompt."))

    # visual_blocks must have at least one block
    raw_blocks = payload.get("visual_blocks")
    if not isinstance(raw_blocks, list) or len(raw_blocks) == 0:
        issues.append(_issue("missing_visual_blocks", "visual_blocks must contain at least one block"))

    issues.extend(_validate_text_quality(payload, program_type))

    questions = _quiz_questions(quiz_payload, payload)
    if len(questions) < 10:
        issues.append(_issue("fewer_than_10_questions", "Quiz must include at least 10 questions."))

    for index, question in enumerate(questions, start=1):
        q_errors = _validate_question_item(question, index, program_type)
        issues.extend(q_errors)

    # Additional block-level validation
    for block in _visual_blocks(payload):
        block_type = block.get("type", "") if isinstance(block, dict) else ""
        data = block.get("data", {}) if isinstance(block, dict) else {}
        if block_type == "area_model":
            rows = int(data.get("rows") or 0)
            cols = int(data.get("cols") or 0)
            total = int(data.get("total") or 0)
            if rows > 0 and cols > 0 and total > 0 and rows * cols != total:
                issues.append(_issue("area_model_invalid", f"area_model rows*cols ({rows}*{cols}={rows*cols}) != total ({total})"))
        if block_type == "number_sentence":
            if not _has_text(data.get("content_th")) and not _has_text(data.get("expression")):
                issues.append(_issue("number_sentence_missing_content", "number_sentence block must have content_th or expression"))

    return {
        "lesson_id": payload.get("lesson_id") or payload.get("id"),
        "program_type": program_type,
        "grade_level": payload.get("grade_level"),
        "topic_code": payload.get("topic_code") or payload.get("skill_code"),
        "publish_status": payload.get("status") or "approved",
        "publishable": not any(issue["severity"] == "error" for issue in issues),
        "issues": issues,
    }


def _validate_question_item(question: dict[str, Any], index: int, program_type: str) -> list[dict[str, str]]:
    """Validate a single question dict, returning a list of issues."""
    issues: list[dict[str, str]] = []
    q_id = f"Question {index}"

    choices = question.get("choices")
    correct_answer = question.get("correct_answer") or question.get("answer")
    explanation = question.get("explanation") or question.get("explanation_th") or question.get("explanation_en")
    question_text = question.get("question_th") or question.get("question_text") or question.get("question_text_th") or question.get("question_text_en")

    # Choices must be a list with at least 2 items
    if not isinstance(choices, list):
        issues.append(_issue("invalid_choices", f"{q_id} choices must be a list"))
        choices = []
    elif len(choices) < 2:
        issues.append(_issue("too_few_choices", f"{q_id} must have at least 2 choices"))

    # Check for duplicate/empty choices
    if isinstance(choices, list):
        normalized = [str(c).strip() for c in choices]
        if len(normalized) != len(set(normalized)):
            issues.append(_issue("duplicate_choices", f"{q_id} has duplicate choices"))
        if any(c == "" for c in normalized):
            issues.append(_issue("empty_choice", f"{q_id} has an empty choice"))

    # correct_answer must exist and match one of the choices
    if not _has_text(correct_answer):
        issues.append(_issue("missing_answer_key", f"{q_id} is missing a correct answer."))
    elif isinstance(choices, list) and str(correct_answer).strip() not in [str(c).strip() for c in choices]:
        issues.append(_issue("answer_not_in_choices", f"{q_id} correct_answer is not among the choices"))

    # explanation must not be empty
    if not _has_text(explanation):
        issues.append(_issue("missing_explanation", f"{q_id} is missing an explanation."))

    # question text must exist
    if not _has_text(question_text):
        issues.append(_issue("empty_required_field", f"{q_id} is missing question text."))

    # Garbled text check in question
    q_text_blob = "\n".join(_walk_text(question))
    for marker in GARBLED_MARKERS:
        if marker in q_text_blob:
            issues.append(_issue("garbled_text", f"{q_id} contains garbled text marker: {repr(marker)}"))

    return issues


def _load_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _quiz_path_for_lesson(lesson_path: Path, payload: dict[str, Any]) -> Path | None:
    quiz_id = str(payload.get("quiz_id") or payload.get("lesson_id") or lesson_path.stem)
    candidate = lesson_path.parent.parent / "quizzes" / f"{quiz_id}.json"
    return candidate if candidate.exists() else None


def content_quality_report(content_root: Path = CONTENT_ROOT) -> dict[str, Any]:
    lessons: list[dict[str, Any]] = []
    by_topic: dict[str, set[str]] = {}
    for lesson_path in sorted(content_root.glob("grade_*/lessons/*.json")):
        payload = _load_json(lesson_path)
        if not payload:
            lessons.append(
                {
                    "lesson_id": lesson_path.stem,
                    "program_type": "UNKNOWN",
                    "source_path": str(lesson_path),
                    "publish_status": "needs_review",
                    "publishable": False,
                    "issues": [_issue("invalid_json", "Lesson JSON could not be parsed.")],
                }
            )
            continue
        payload.setdefault("lesson_id", lesson_path.stem)
        quiz_path = _quiz_path_for_lesson(lesson_path, payload)
        quiz_payload = _load_json(quiz_path) if quiz_path else None
        validation = validate_lesson_payload(payload, quiz_payload=quiz_payload)
        topic_code = str(validation.get("topic_code") or lesson_path.stem)
        program_type = str(validation["program_type"])
        by_topic.setdefault(topic_code, set()).add(program_type)
        lessons.append(
            {
                **validation,
                "title": payload.get("title_en") or payload.get("title_th") or lesson_path.stem,
                "source_path": str(lesson_path),
                "quiz_path": str(quiz_path) if quiz_path else None,
            }
        )

    missing_tracks = []
    for topic_code, tracks in sorted(by_topic.items()):
        if "THP" not in tracks:
            missing_tracks.append({"topic_code": topic_code, "missing": "THP", "code": "missing_thp_lesson"})
        if "EP" not in tracks:
            missing_tracks.append({"topic_code": topic_code, "missing": "EP", "code": "missing_ep_lesson"})

    return {
        "summary": {
            "total_lessons": len(lessons),
            "publishable": sum(1 for lesson in lessons if lesson.get("publishable")),
            "needs_review": sum(1 for lesson in lessons if not lesson.get("publishable")),
            "missing_tracks": len(missing_tracks),
        },
        "missing_tracks": missing_tracks,
        "lessons": lessons,
    }
