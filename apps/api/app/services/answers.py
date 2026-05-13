import re
import unicodedata
from typing import Any

from app.models import Question


THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")
COMMON_PUNCTUATION = str.maketrans(
    {
        "：": ":",
        "％": "%",
        "／": "/",
        "–": "-",
        "—": "-",
        "−": "-",
        "，": ",",
        "、": ",",
        "“": '"',
        "”": '"',
        "‘": "'",
        "’": "'",
        "\u00a0": " ",
    }
)


def normalize_answer(value: Any) -> str:
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFKC", text)
    text = text.translate(THAI_DIGITS).translate(COMMON_PUNCTUATION)
    text = re.sub(r"\s+", " ", text.strip())
    text = re.sub(r"\s*/\s*", "/", text)
    text = re.sub(r"\s*%\b", "%", text)
    text = re.sub(r"(\d)\s+%", r"\1%", text)
    return text


def _metadata(question: Question) -> dict:
    return question.metadata_json or {}


def _answer_values(question: Question) -> list[str]:
    metadata = _metadata(question)
    values: list[Any] = [question.correct_answer, metadata.get("answer")]
    accepted = metadata.get("accepted_answers") or []
    if isinstance(accepted, (str, int, float)):
        values.append(accepted)
    elif isinstance(accepted, list):
        values.extend(accepted)
    return [str(value) for value in values if value is not None and str(value) != ""]


def _choice_text(choice: Any) -> str:
    text = str(choice)
    return re.sub(r"^\s*[A-Da-d1-9]\s*[:.)-]\s*", "", text).strip()


def _choice_candidates(question: Question, selected_answer: Any) -> list[str]:
    raw = str(selected_answer).strip()
    choices = question.choices or []
    if not choices:
        return []
    candidates: list[str] = []
    if raw.isdigit():
        index = int(raw)
        for offset in (1, 0):
            choice_index = index - offset
            if 0 <= choice_index < len(choices):
                candidates.extend([str(choices[choice_index]), _choice_text(choices[choice_index])])
                break
    if len(raw) == 1 and raw.upper() in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        choice_index = ord(raw.upper()) - ord("A")
        if 0 <= choice_index < len(choices):
            candidates.extend([str(choices[choice_index]), _choice_text(choices[choice_index])])
    return [candidate for candidate in candidates if candidate]


def answer_match_details(question: Question, selected_answer: Any) -> dict:
    selected_raw = "" if selected_answer is None else str(selected_answer)
    correct_values = _answer_values(question)
    selected_normalized = normalize_answer(selected_raw)
    correct_normalized = normalize_answer(correct_values[0] if correct_values else question.correct_answer)

    if selected_raw in correct_values:
        is_correct = True
    else:
        normalized_correct_values = {normalize_answer(value) for value in correct_values}
        selected_candidates = [selected_raw, selected_normalized, *_choice_candidates(question, selected_raw)]
        is_correct = any(candidate in correct_values or normalize_answer(candidate) in normalized_correct_values for candidate in selected_candidates)

    return {
        "selected_answer_raw": selected_raw,
        "selected_answer_normalized": selected_normalized,
        "correct_answer_normalized": correct_normalized,
        "is_correct": is_correct,
    }


def is_answer_correct(question: Question, selected_answer: Any) -> bool:
    return bool(answer_match_details(question, selected_answer)["is_correct"])
