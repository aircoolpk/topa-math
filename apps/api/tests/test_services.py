import pytest

from app.models import Question
from app.services.answers import answer_match_details, is_answer_correct, normalize_answer
from app.services.ai_validation import validate_generated_practice
from app.services.content_quality import CONTENT_ROOT, content_quality_report, lesson_is_student_visible, validate_lesson_payload
from app.services.mastery import AnswerResult, calculate_mastery_score, infer_mistake_type, mastery_level
from app.services.ranking import RankingInput, build_rankings, normalize_speed_points, rank_score
from app.services.rank_titles import rank_title_for_score
from app.services.xp import level_from_total_xp, required_xp_for_next_level


def _question(correct_answer="27", choices=None, metadata=None) -> Question:
    return Question(
        skill_id="skill-1",
        grade_level=1,
        question_type="multiple_choice",
        difficulty="easy",
        question_text="?",
        choices=choices or [],
        correct_answer=correct_answer,
        metadata_json=metadata or {},
    )


def test_answer_normalization_accepts_safe_formatting_differences():
    assert normalize_answer("  1   / 2 ") == "1/2"
    assert normalize_answer("๕๐ %") == "50%"
    assert is_answer_correct(_question(27), "27")
    assert is_answer_correct(_question("27"), " 27 ")
    assert is_answer_correct(_question("27"), "๒๗")
    assert is_answer_correct(_question("4 เหลือ 4"), "๔   เหลือ  ๔")


def test_answer_matching_supports_choice_index_choice_text_and_accepted_answers():
    assert is_answer_correct(_question("banana", choices=["apple", "banana", "orange"]), "2")
    assert is_answer_correct(_question("banana", choices=["A: apple", "B: banana", "C: orange"]), "B")
    assert is_answer_correct(_question("1/2", metadata={"answer": "0.5", "accepted_answers": ["50%"]}), "50 %")
    assert not is_answer_correct(_question("27"), "28")


def test_answer_match_details_include_raw_and_normalized_values():
    details = answer_match_details(_question("27"), " ๒๗ ")
    assert details == {
        "selected_answer_raw": " ๒๗ ",
        "selected_answer_normalized": "27",
        "correct_answer_normalized": "27",
        "is_correct": True,
    }


def test_mastery_score_and_level_are_bounded():
    results = [AnswerResult(True, 6000), AnswerResult(True, 8000), AnswerResult(False, 12000)]
    score = calculate_mastery_score(results)
    assert 0 <= score <= 100
    assert mastery_level(score) in {"needs_help", "learning", "good", "mastered"}


def test_mistake_type_inference_edge_cases():
    assert infer_mistake_type(False, 800) == "careless_mistake"
    assert infer_mistake_type(False, 5000, previous_incorrect_for_skill=3) == "concept_misunderstanding"
    assert infer_mistake_type(True, 20000) == "speed_issue"


def test_ranking_formula_and_privacy_shape():
    rows = [
        RankingInput("child-1", "น้องเอ", 2, "Bangkok", 80, 7000, 20),
        RankingInput("child-2", "น้องบี", 2, "Bangkok", 70, 9000, 30),
    ]
    rankings = build_rankings(rows, grade_level=2, province="Bangkok")
    assert rankings[0]["rank_position"] == 1
    assert "nickname" in rankings[0]
    assert "email" not in rankings[0]
    assert normalize_speed_points(100) == 0
    assert rank_score(80, 90, 20) == 64


def test_xp_level_formula():
    assert required_xp_for_next_level(1) == 100
    assert level_from_total_xp(0) == 1
    assert level_from_total_xp(100) == 2


def test_rank_title_calculation():
    assert rank_title_for_score(0) == "เด็กหลังห้อง"
    assert rank_title_for_score(100) == "เด็กนักเรียน"
    assert rank_title_for_score(3500) == "เด็กอัจฉริยะ"


def test_ai_generated_content_validation():
    payload = {
        "lesson_summary": "ฝึกบวกเลขง่าย ๆ",
        "teaching_strategy": "นับเพิ่มทีละจำนวน",
        "questions": [
            {
                "question_text": "2 + 1 = ?",
                "question_type": "multiple_choice",
                "choices": ["1", "2", "3", "4"],
                "correct_answer": "3",
                "explanation": "2 + 1 เท่ากับ 3",
                "hint": "นับต่อจาก 2 หนึ่งครั้ง",
                "skill_id": "skill-1",
                "difficulty": "easy",
                "mistake_type_target": "calculation_error",
            }
        ],
    }
    practice = validate_generated_practice(payload, expected_skill_id="skill-1", expected_difficulty="easy")
    assert practice.questions[0].correct_answer == "3"


def test_ai_generated_content_rejects_bad_choice_count():
    payload = {
        "lesson_summary": "x",
        "teaching_strategy": "x",
        "questions": [
            {
                "question_text": "2 + 1 = ?",
                "question_type": "multiple_choice",
                "choices": ["1", "3"],
                "correct_answer": "3",
                "explanation": "x",
                "hint": "x",
                "skill_id": "skill-1",
                "difficulty": "easy",
                "mistake_type_target": "calculation_error",
            }
        ],
    }
    with pytest.raises(ValueError):
        validate_generated_practice(payload, expected_skill_id="skill-1")


def test_content_quality_accepts_sample_thp_and_ep_lessons():
    report = content_quality_report(CONTENT_ROOT)
    samples = {
        lesson["lesson_id"]: lesson
        for lesson in report["lessons"]
        if lesson["lesson_id"] in {"g3_multiplication_area_model_thp", "g3_multiplication_area_model_ep"}
    }
    assert samples["g3_multiplication_area_model_thp"]["program_type"] == "THP"
    assert samples["g3_multiplication_area_model_thp"]["publishable"] is True
    assert samples["g3_multiplication_area_model_ep"]["program_type"] == "EP"
    assert samples["g3_multiplication_area_model_ep"]["publishable"] is True


def test_content_quality_blocks_incomplete_quality_required_lesson():
    lesson = {
        "lesson_id": "draft_lesson",
        "content_schema_version": "2.0",
        "quality_required": True,
        "status": "approved",
        "program_type": "THP",
        "grade_level": 3,
        "title_th": "ไม่มีเนื้อหา",
        "objective_th": "",
    }
    validation = validate_lesson_payload(lesson, quiz_payload={"questions": []})
    assert validation["publishable"] is False
    assert any(issue["code"] == "placeholder_text" for issue in validation["issues"])
    assert lesson_is_student_visible(lesson, {"questions": []}) is False
