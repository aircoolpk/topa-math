from __future__ import annotations

import json
import re
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"

ALLOWED_BLOCK_TYPES = {
    "story_intro",
    "visual_thinking",
    "model_diagram",
    "number_sentence",
    "mini_quiz",
}

MODEL_BLOCK_TYPES = {
    "area_model",
    "array_model",
    "bar_model",
    "number_bond",
    "part_whole_model",
    "place_value_chart",
    "ten_frame",
}

DEPRECATED_BLOCK_TYPES = {"step_cards", "worked_example", "common_mistakes"}


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None
    return value if isinstance(value, dict) else None


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _parse_json_like(value: Any) -> Any:
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        if stripped[0] in "[{":
            try:
                return json.loads(stripped)
            except Exception:
                return value
    return value


def program_alias(value: Any) -> str:
    raw = str(value or "TH").strip().upper()
    if raw in {"EP", "EN", "ENGLISH"}:
        return "EP"
    return "TH"


def lesson_program_alias(payload: dict[str, Any]) -> str:
    return program_alias(payload.get("program_type") or payload.get("content_program_type") or payload.get("track"))


def _normalize_nested(value: Any) -> Any:
    value = _parse_json_like(value)
    if isinstance(value, dict):
        return {str(key): _normalize_nested(nested) for key, nested in value.items()}
    if isinstance(value, list):
        return [_normalize_nested(item) for item in value]
    return value


def _block_data(block: dict[str, Any]) -> dict[str, Any]:
    raw_data = _parse_json_like(block.get("data"))
    if isinstance(raw_data, dict):
        data = dict(raw_data)
    else:
        data = {}
    for key, value in block.items():
        if key in {"type", "block_type", "data", "title", "title_th", "title_en"}:
            continue
        data.setdefault(str(key), value)
    if "content" in block and "text_th" not in data and "text" not in data:
        data["text_th"] = block["content"]
    return _normalize_nested(data)


def _letter_choice_index(value: Any) -> int | None:
    text = str(value or "").strip().upper()
    return {"A": 0, "B": 1, "C": 2, "D": 3}.get(text)


def _number_text(value: Any) -> str | None:
    number = _number_value(value)
    if number is None:
        return None
    return str(int(number)) if float(number).is_integer() else f"{number:g}"


def _normalize_mini_quiz_data(data: dict[str, Any]) -> dict[str, Any]:
    question = data.get("question_th") or data.get("question") or data.get("question_en") or ""
    choices = data.get("choices") if isinstance(data.get("choices"), list) else []
    choices = [str(choice).strip() for choice in choices]
    raw_answer = data.get("correct_answer")
    if raw_answer is None or str(raw_answer).strip() == "":
        raw_answer = data.get("answer")

    index = _letter_choice_index(raw_answer)
    if index is not None and index < len(choices):
        raw_answer = choices[index]

    explanation = data.get("explanation_th") or data.get("explanation") or data.get("explanation_en") or ""
    expected = _arithmetic_expected(" ".join([str(question), str(explanation)]))
    if expected is not None:
        expected_text = str(int(expected)) if float(expected).is_integer() else f"{expected:g}"
        numeric_choices = [_number_text(choice) for choice in choices]
        if numeric_choices and all(choice is not None for choice in numeric_choices):
            choices = [str(choice) for choice in numeric_choices]
        raw_answer = expected_text

    answer = str(raw_answer or "").strip()
    if answer not in choices:
        answer_number = _number_text(answer)
        for choice in choices:
            if answer_number is not None and _number_text(choice) == answer_number:
                answer = choice
                break

    return {
        "question_th": str(question),
        "choices": choices,
        "correct_answer": answer,
        "answer": answer,
        "explanation_th": str(explanation),
    }


def _normalize_grouping_model_data(data: dict[str, Any]) -> dict[str, Any]:
    group_count = int(_number_value(data.get("groups")) or 0)
    items_per_group = int(_number_value(data.get("items_per_group")) or 0)
    groups = data.get("groups") if isinstance(data.get("groups"), list) else []
    if not groups and group_count > 0:
        groups = [
            {"group_index": index + 1, "item_count": items_per_group}
            for index in range(group_count)
        ]
    return {
        **data,
        "model_type": "sharing_groups",
        "groups": groups,
    }


def _normalize_block(block: Any) -> dict[str, Any] | None:
    block = _parse_json_like(block)
    if isinstance(block, list):
        nested = normalize_lesson_visual_blocks(block)
        return nested[0] if nested else None
    if not isinstance(block, dict):
        return None

    raw_type = str(block.get("type") or block.get("block_type") or "").strip()
    if raw_type in DEPRECATED_BLOCK_TYPES:
        return None
    block_type = raw_type
    data = _block_data(block)

    if block_type == "grouping_model":
        data = _normalize_grouping_model_data(data)
        block_type = "model_diagram"
    elif block_type in MODEL_BLOCK_TYPES:
        data.setdefault("model_type", block_type)
        block_type = "model_diagram"
    elif block_type in {"emoji_counter", "thinking_prompt", "visual_prompt"}:
        block_type = "visual_thinking"
    elif block_type in {"equation", "expression", "number_sentence"}:
        block_type = "number_sentence"
    elif block_type not in ALLOWED_BLOCK_TYPES:
        if data.get("question") or data.get("choices"):
            block_type = "mini_quiz"
        elif data.get("equation") or data.get("expression"):
            block_type = "number_sentence"
        else:
            block_type = "visual_thinking"

    if block_type == "mini_quiz":
        data = _normalize_mini_quiz_data(data)

    title = block.get("title_th") or block.get("title") or block.get("title_en") or ""
    return {"type": block_type, "title_th": str(title), "data": data}


def normalize_lesson_visual_blocks(value: Any) -> list[dict[str, Any]]:
    value = _parse_json_like(value)
    if value is None:
        return []
    if isinstance(value, dict):
        block = _normalize_block(value)
        return [block] if block else []
    if not isinstance(value, list):
        block = _normalize_block(value)
        return [block] if block else []

    normalized: list[dict[str, Any]] = []
    for item in value:
        parsed = _parse_json_like(item)
        if isinstance(parsed, list):
            normalized.extend(normalize_lesson_visual_blocks(parsed))
            continue
        block = _normalize_block(parsed)
        if block:
            normalized.append(block)
    return normalized


def _lesson_files() -> list[Path]:
    return sorted(CONTENT_ROOT.glob("grade_*/lessons/*.json"))


def _base_lesson_id(payload: dict[str, Any], path: Path | None = None) -> str:
    lesson_id = str(payload.get("lesson_id") or payload.get("id") or (path.stem if path else "")).strip()
    topic_code = str(payload.get("topic_code") or "").strip()
    if topic_code:
        return topic_code
    for suffix in ("_thp", "_th", "_ep"):
        if lesson_id.endswith(suffix):
            return lesson_id[: -len(suffix)]
    return lesson_id


def _lesson_identity_matches(payload: dict[str, Any], path: Path, lesson_id: str) -> bool:
    candidates = {
        path.stem,
        str(payload.get("lesson_id") or ""),
        str(payload.get("id") or ""),
        str(payload.get("topic_code") or ""),
        str(payload.get("skill_code") or ""),
        _base_lesson_id(payload, path),
    }
    return lesson_id in candidates


def find_lesson_file(lesson_id: str, program_type: str | None = None) -> tuple[Path, dict[str, Any], bool] | None:
    requested = program_alias(program_type) if program_type else None
    matches: list[tuple[Path, dict[str, Any]]] = []
    for path in _lesson_files():
        payload = _read_json(path)
        if payload and _lesson_identity_matches(payload, path, lesson_id):
            matches.append((path, payload))
    if not matches:
        return None

    if requested:
        for path, payload in matches:
            if lesson_program_alias(payload) == requested:
                return path, payload, False
        if requested == "EP":
            for path, payload in matches:
                if lesson_program_alias(payload) == "TH":
                    return path, payload, True
        return None

    return matches[0][0], matches[0][1], False


def list_lessons(grade_level: int | None = None, program_type: str | None = None, search: str | None = None) -> list[dict[str, Any]]:
    requested = program_alias(program_type) if program_type else None
    query = (search or "").strip().lower()
    grouped: dict[str, dict[str, Any]] = {}
    for path in _lesson_files():
        payload = _read_json(path)
        if not payload:
            continue
        grade = int(payload.get("grade_level") or 0)
        if grade_level is not None and grade != grade_level:
            continue
        program = lesson_program_alias(payload)
        if requested and program != requested:
            continue
        lesson_id = _base_lesson_id(payload, path)
        title_th = str(payload.get("title_th") or "")
        title_en = str(payload.get("title_en") or "")
        if query and query not in " ".join([lesson_id, title_th, title_en]).lower():
            continue
        result = validate_lesson_content(payload)
        current = grouped.setdefault(
            lesson_id,
            {
                "lesson_id": lesson_id,
                "grade_level": grade,
                "title_th": title_th,
                "title_en": title_en,
                "topic_code": payload.get("topic_code") or lesson_id,
                "skill_code": payload.get("skill_code") or lesson_id,
                "has_th": False,
                "has_ep": False,
                "validation_status": "valid",
                "issue_count": 0,
            },
        )
        current["has_ep" if program == "EP" else "has_th"] = True
        current["title_th"] = current["title_th"] or title_th
        current["title_en"] = current["title_en"] or title_en
        issue_count = len(result["errors"]) + len(result["warnings"])
        current["issue_count"] += issue_count
        if result["errors"]:
            current["validation_status"] = "invalid"
        elif result["warnings"] and current["validation_status"] == "valid":
            current["validation_status"] = "warning"
    return sorted(grouped.values(), key=lambda item: (item["grade_level"], item["lesson_id"]))


def _mini_quiz_payload(block: dict[str, Any]) -> dict[str, Any]:
    data = block.get("data") if isinstance(block.get("data"), dict) else {}
    return {
        "question": block.get("question") or data.get("question") or data.get("question_th") or data.get("question_en"),
        "choices": block.get("choices") or data.get("choices"),
        "correct_answer": block.get("correct_answer") or data.get("correct_answer") or data.get("answer"),
        "explanation": block.get("explanation") or data.get("explanation") or data.get("explanation_th") or data.get("explanation_en"),
    }


def _number_value(value: Any) -> float | None:
    text = str(value or "").strip()
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def _arithmetic_expected(question: Any) -> float | None:
    text = str(question or "")
    text = text.replace("÷", "/").replace("Ã·", "/").replace("×", "*").replace("x", "*").replace("X", "*")
    match = re.search(r"(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)", text)
    if not match:
        return None
    left = float(match.group(1))
    op = match.group(2)
    right = float(match.group(3))
    if op == "+":
        return left + right
    if op == "-":
        return left - right
    if op == "*":
        return left * right
    if op == "/" and right != 0:
        return left / right
    return None


def _validate_quiz_payload(quiz: dict[str, Any], errors: list[str], prefix: str) -> None:
    question = quiz.get("question")
    choices = quiz.get("choices")
    correct_answer = quiz.get("correct_answer")
    explanation = quiz.get("explanation")
    if not question:
        errors.append(f"{prefix}: mini_quiz question is required")
    if not isinstance(choices, list) or len(choices) != 4:
        errors.append(f"{prefix}: mini_quiz choices must contain exactly 4 items")
        choices = choices if isinstance(choices, list) else []
    normalized_choices = [str(choice).strip() for choice in choices]
    if len(set(normalized_choices)) != len(normalized_choices):
        errors.append(f"{prefix}: mini_quiz choices must be unique")
    if correct_answer is None or str(correct_answer).strip() == "":
        errors.append(f"{prefix}: mini_quiz correct_answer is required")
    elif str(correct_answer).strip() not in normalized_choices:
        errors.append(f"{prefix}: mini_quiz correct_answer must be one of the choices")
    if not explanation:
        errors.append(f"{prefix}: mini_quiz explanation is required")

    expected = _arithmetic_expected(question)
    selected = _number_value(correct_answer)
    if expected is not None and selected is not None and abs(expected - selected) > 0.000001:
        errors.append(f"{prefix}: arithmetic answer should be {expected:g}")


def _validate_raw_arithmetic_answer(quiz: dict[str, Any], errors: list[str], prefix: str) -> None:
    question = quiz.get("question")
    explanation = quiz.get("explanation")
    expected = _arithmetic_expected(" ".join([str(question or ""), str(explanation or "")]))
    if expected is None:
        return
    choices = quiz.get("choices") if isinstance(quiz.get("choices"), list) else []
    raw_answer = quiz.get("correct_answer")
    index = _letter_choice_index(raw_answer)
    if index is not None and index < len(choices):
        raw_answer = choices[index]
    selected = _number_value(raw_answer)
    if selected is not None and abs(expected - selected) > 0.000001:
        errors.append(f"{prefix}: arithmetic answer should be {expected:g}")


def validate_lesson_content(lesson: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    lesson_id = str(lesson.get("lesson_id") or lesson.get("id") or "").strip()
    if not lesson_id:
        errors.append("lesson_id is required")
    try:
        grade = int(lesson.get("grade_level"))
    except Exception:
        grade = 0
    if grade < 1 or grade > 6:
        errors.append("grade_level must be between 1 and 6")

    raw_blocks = _parse_json_like(lesson.get("visual_blocks"))
    if not isinstance(raw_blocks, list):
        errors.append("visual_blocks must be a list")
        raw_blocks = []

    for index, raw_block in enumerate(raw_blocks):
        parsed = _parse_json_like(raw_block)
        if not isinstance(parsed, dict):
            errors.append(f"visual_blocks[{index}] must be an object")
            continue
        raw_type = str(parsed.get("type") or parsed.get("block_type") or "").strip()
        if raw_type in DEPRECATED_BLOCK_TYPES:
            errors.append(f"visual_blocks[{index}] uses deprecated block type {raw_type}")
        if raw_type == "mini_quiz":
            _validate_raw_arithmetic_answer(_mini_quiz_payload({"data": _block_data(parsed)}), errors, f"visual_blocks[{index}]")
        block = _normalize_block(parsed)
        if not block:
            errors.append(f"visual_blocks[{index}] is invalid")
            continue
        if block["type"] not in ALLOWED_BLOCK_TYPES:
            errors.append(f"visual_blocks[{index}] has unsupported block type {block['type']}")
        if block["type"] == "mini_quiz":
            _validate_quiz_payload(_mini_quiz_payload(block), errors, f"visual_blocks[{index}]")

    return {"valid": not errors, "errors": errors, "warnings": warnings}


def save_lesson(lesson_id: str, program_type: str | None, payload: dict[str, Any]) -> tuple[Path, Path | None]:
    found = find_lesson_file(lesson_id, program_type)
    path: Path
    if found:
        path = found[0]
    else:
        grade = int(payload.get("grade_level") or 1)
        suffix = "_ep" if program_alias(program_type) == "EP" else ""
        path = CONTENT_ROOT / f"grade_{grade}" / "lessons" / f"{lesson_id}{suffix}.json"
    backup_path = None
    if path.exists():
        backup_dir = CONTENT_ROOT / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
        backup_path = backup_dir / f"{timestamp}_{path.stem}.json"
        shutil.copy2(path, backup_path)
    _write_json(path, payload)
    return path, backup_path


def _quiz_files() -> list[Path]:
    paths = sorted(CONTENT_ROOT.glob("grade_*/quizzes/*.json"))
    paths.extend(sorted(CONTENT_ROOT.glob("question_banks/grade_*/*.jsonl")))
    return paths


def _load_question_rows(path: Path) -> list[dict[str, Any]]:
    if path.suffix == ".jsonl":
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
    payload = _read_json(path) or {}
    questions = payload.get("questions")
    return questions if isinstance(questions, list) else []


def validate_question_payload(question: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    choices = question.get("choices")
    quiz = {
        "question": question.get("question") or question.get("question_text") or question.get("question_text_th") or question.get("question_en"),
        "choices": choices,
        "correct_answer": question.get("correct_answer") or question.get("answer"),
        "explanation": question.get("explanation") or question.get("explanation_th") or question.get("explanation_en"),
    }
    _validate_quiz_payload(quiz, errors, str(question.get("question_id") or question.get("id") or "question"))
    return {"valid": not errors, "errors": errors, "warnings": []}


def list_questions(grade_level: int | None = None, lesson_id: str | None = None, issue_only: bool = False) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for path in _quiz_files():
        grade_match = re.search(r"grade_(\d+)", str(path))
        grade = int(grade_match.group(1)) if grade_match else None
        if grade_level is not None and grade != grade_level:
            continue
        topic = path.stem
        if lesson_id and lesson_id not in {topic, path.stem}:
            continue
        for index, question in enumerate(_load_question_rows(path)):
            validation = validate_question_payload(question)
            if issue_only and validation["valid"]:
                continue
            items.append(
                {
                    "question_id": str(question.get("question_id") or question.get("id") or f"{path.stem}:{index}"),
                    "grade_level": grade,
                    "lesson_id": topic,
                    "question": question.get("question_text_th") or question.get("question_text") or question.get("question") or question.get("question_en"),
                    "choices": question.get("choices") or [],
                    "correct_answer": question.get("correct_answer") or question.get("answer"),
                    "validation_status": "valid" if validation["valid"] else "invalid",
                    "errors": validation["errors"],
                }
            )
    return items


def validate_all_questions() -> dict[str, Any]:
    questions = list_questions()
    invalid = [question for question in questions if question["validation_status"] == "invalid"]
    return {"valid": not invalid, "questions_total": len(questions), "questions_invalid": len(invalid), "items": invalid}


def update_question_payload(question_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    for path in _quiz_files():
        if path.suffix == ".jsonl":
            rows = _load_question_rows(path)
            changed = False
            for index, question in enumerate(rows):
                current_id = str(question.get("question_id") or question.get("id") or f"{path.stem}:{index}")
                if current_id == question_id:
                    question.update(patch)
                    changed = True
                    updated = question
                    break
            if changed:
                path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
                return updated
            continue

        payload = _read_json(path)
        if not payload:
            continue
        questions = payload.get("questions")
        if not isinstance(questions, list):
            continue
        for index, question in enumerate(questions):
            if not isinstance(question, dict):
                continue
            current_id = str(question.get("question_id") or question.get("id") or f"{path.stem}:{index}")
            if current_id == question_id:
                question.update(patch)
                _write_json(path, payload)
                return question
    return None


def qa_summary() -> dict[str, Any]:
    lessons = list_lessons()
    questions = list_questions()
    invalid_lessons = [lesson for lesson in lessons if lesson["validation_status"] == "invalid"]
    invalid_questions = [question for question in questions if question["validation_status"] == "invalid"]
    common: dict[str, int] = {}
    for lesson in invalid_lessons:
        common["invalid_lesson"] = common.get("invalid_lesson", 0) + 1
    for question in invalid_questions:
        for error in question.get("errors", []):
            key = str(error).split(":")[-1].strip()
            common[key] = common.get(key, 0) + 1
    return {
        "lessons_total": len(lessons),
        "lessons_valid": len(lessons) - len(invalid_lessons),
        "lessons_invalid": len(invalid_lessons),
        "questions_total": len(questions),
        "questions_invalid": len(invalid_questions),
        "common_issues": [{"issue": key, "count": count} for key, count in sorted(common.items())],
    }
