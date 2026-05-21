from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


CONTENT_ROOT = Path(__file__).resolve().parents[1] / "content" / "math"
BACKUP_ROOT = CONTENT_ROOT / "_content_backups" / datetime.now(UTC).strftime("%Y%m%d_%H%M%S_content_repair")


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None
    return value if isinstance(value, dict) else None


def write_json(path: Path, payload: dict[str, Any]) -> None:
    backup(path)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    backup(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")


def backup(path: Path) -> None:
    if not path.exists():
        return
    rel = path.relative_to(CONTENT_ROOT)
    target = BACKUP_ROOT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)


def lesson_files() -> list[Path]:
    return sorted(CONTENT_ROOT.glob("grade_*/lessons/*.json"))


def base_lesson_id(lesson_id: str) -> str:
    for suffix in ("_ep", "_thp", "_th"):
        if lesson_id.lower().endswith(suffix):
            return lesson_id[: -len(suffix)]
    return lesson_id


def language_for(path: Path, payload: dict[str, Any]) -> str:
    raw = str(payload.get("program_type") or payload.get("content_program_type") or payload.get("track") or "").upper()
    if raw in {"EP", "EN", "ENGLISH"} or path.stem.lower().endswith("_ep"):
        return "EP"
    return "TH"


def grade_from_path(path: Path) -> int:
    try:
        return int(path.parent.parent.name.split("_")[-1])
    except Exception:
        return 0


def title_for(payload: dict[str, Any], language: str) -> str:
    if language == "EP":
        return str(payload.get("title_en") or payload.get("title_th") or payload.get("lesson_id") or "Math lesson")
    return str(payload.get("title_th") or payload.get("title_en") or payload.get("lesson_id") or "บทเรียนคณิตศาสตร์")


def is_decimal(lesson_id: str) -> bool:
    return any(key in lesson_id for key in ("decimal", "money", "percent"))


def is_multi_step(lesson_id: str) -> bool:
    return "multi_step" in lesson_id or "word_problem" in lesson_id or "word_problems" in lesson_id


def is_multiply(lesson_id: str) -> bool:
    return "multiplication" in lesson_id or "multiply" in lesson_id or "times" in lesson_id


def is_division(lesson_id: str) -> bool:
    return "division" in lesson_id or "divide" in lesson_id


def is_geometry(lesson_id: str) -> bool:
    return any(key in lesson_id for key in ("area", "volume", "geometry", "shape", "angles", "circle"))


def th_blocks(lesson_id: str, title: str) -> list[dict[str, Any]]:
    if is_decimal(lesson_id):
        return [
            {"type": "story_intro", "title": "เรื่องราวชวนคิด", "content": "มีสมุดราคา 23.75 บาท จ่ายธนบัตร 50 บาท ต้องได้เงินทอนเท่าไร ลองคิดจากเงินที่จ่ายลบด้วยราคาสินค้า"},
            {"type": "visual_thinking", "title": "มองภาพก่อน", "content": "ดูเงินที่จ่าย ราคา และเงินทอนให้ครบก่อนคำนวณ", "data": {"paid": 50, "price": 23.75, "change": 26.25, "description_th": "เงินทอน = เงินที่จ่าย - ราคาสินค้า"}},
            {"type": "model_diagram", "title": "ใช้แผนภาพช่วยคิด", "description": "เส้นเงิน 50 บาท แบ่งออกเป็นราคาสินค้า 23.75 บาท และเงินทอน 26.25 บาท", "model_type": "bar_model", "groups": [{"label": "ราคา", "value": 23.75}, {"label": "เงินทอน", "value": 26.25}]},
            {"type": "number_sentence", "title": "เขียนเป็นประโยควิธีทำ", "expression": "50 - 23.75 = 26.25 บาท", "content": "ตั้งจุดทศนิยมให้ตรงกัน แล้วลบทีละหลัก"},
            {"type": "mini_quiz", "title": "ลองทำดู", "question": "จ่ายเงิน 50 บาท ซื้อของราคา 23.75 บาท จะได้เงินทอนเท่าไร", "choices": ["24.25 บาท", "25.25 บาท", "26.25 บาท", "27.25 บาท"], "correct_answer": "26.25 บาท", "answer": "26.25 บาท", "explanation": "50.00 - 23.75 = 26.25 บาท"},
        ]
    if is_multi_step(lesson_id):
        return [
            {"type": "story_intro", "title": "เรื่องราวชวนคิด", "content": "ร้านน้ำผลไม้ขายแก้วละ 15 บาท ได้ 8 แก้ว และมีต้นทุนแก้วละ 6 บาท ต้องหากำไรทั้งหมด"},
            {"type": "visual_thinking", "title": "มองภาพก่อน", "content": "โจทย์มี 3 ส่วนสำคัญ: ราคาขาย จำนวนแก้ว และต้นทุนต่อแก้ว"},
            {"type": "model_diagram", "title": "ใช้แผนภาพช่วยคิด", "description": "คิดยอดขายก่อน จากนั้นคิดต้นทุน แล้วนำมาลบกัน", "model_type": "multi_step_model", "step1": {"label": "ยอดขาย", "expression": "15 × 8", "result": "120 บาท"}, "step2": {"label": "ต้นทุน", "expression": "6 × 8", "result": "48 บาท"}, "step3": {"label": "กำไร", "expression": "120 - 48", "result": "72 บาท"}},
            {"type": "number_sentence", "title": "เขียนเป็นประโยควิธีทำ", "expression": "(15 × 8) - (6 × 8) = 72 บาท", "content": "ทำทีละขั้นแล้วค่อยรวมเป็นประโยคเดียว"},
            {"type": "mini_quiz", "title": "ลองทำดู", "question": "ขายขนม 5 ชิ้น ชิ้นละ 10 บาท ต้นทุนชิ้นละ 4 บาท ได้กำไรเท่าไร", "choices": ["20 บาท", "25 บาท", "30 บาท", "50 บาท"], "correct_answer": "30 บาท", "answer": "30 บาท", "explanation": "ยอดขาย 5×10=50 ต้นทุน 5×4=20 กำไร 50-20=30"},
        ]
    if is_geometry(lesson_id):
        return [
            {"type": "story_intro", "title": "เรื่องราวชวนคิด", "content": f"วันนี้เราจะใช้ภาพช่วยเข้าใจเรื่อง {title} โดยค่อย ๆ ดูข้อมูลและสูตรที่เกี่ยวข้อง"},
            {"type": "visual_thinking", "title": "มองภาพก่อน", "content": "สังเกตความยาว ความกว้าง จำนวนช่อง หรือข้อมูลที่โจทย์ให้"},
            {"type": "model_diagram", "title": "ใช้แผนภาพช่วยคิด", "description": "ตัวอย่างสี่เหลี่ยมกว้าง 4 หน่วย ยาว 6 หน่วย มีพื้นที่ 24 ตารางหน่วย", "model_type": "area_model", "rows": 4, "cols": 6, "total": 24, "unit": "ตารางหน่วย"},
            {"type": "number_sentence", "title": "เขียนเป็นประโยควิธีทำ", "expression": "4 × 6 = 24", "content": "เลือกสูตรให้ตรงกับโจทย์ แล้วแทนค่าทีละตัว"},
            {"type": "mini_quiz", "title": "ลองทำดู", "question": "รูปสี่เหลี่ยมกว้าง 5 หน่วย ยาว 6 หน่วย มีพื้นที่เท่าไร", "choices": ["11", "24", "30", "36"], "correct_answer": "30", "answer": "30", "explanation": "พื้นที่ = กว้าง × ยาว = 5 × 6 = 30"},
        ]
    if is_multiply(lesson_id):
        expression = "6 × 4 = 24"
        quiz = ("มี 6 กลุ่ม กลุ่มละ 4 ชิ้น รวมกี่ชิ้น", "24")
    elif is_division(lesson_id):
        expression = "24 ÷ 4 = 6"
        quiz = ("มี 24 ชิ้น แบ่งเป็น 4 กลุ่มเท่า ๆ กัน กลุ่มละกี่ชิ้น", "6")
    else:
        expression = "18 + 7 = 25"
        quiz = ("18 + 7 = ?", "25")
    return [
        {"type": "story_intro", "title": "เรื่องราวชวนคิด", "content": f"ลองอ่านโจทย์เรื่อง {title} ให้ช้า ๆ แล้วหาตัวเลขสำคัญก่อนเริ่มคิด"},
        {"type": "visual_thinking", "title": "มองภาพก่อน", "content": "แยกข้อมูลที่โจทย์ให้ และวงคำถามสุดท้ายว่าอยากรู้อะไร"},
        {"type": "model_diagram", "title": "ใช้แผนภาพช่วยคิด", "description": "ใช้ช่องหรือกลุ่มช่วยจัดข้อมูลให้เห็นภาพ", "model_type": "array_model", "rows": 4, "cols": 6, "total": 24, "unit": "ชิ้น"},
        {"type": "number_sentence", "title": "เขียนเป็นประโยควิธีทำ", "expression": expression, "content": "เขียนเครื่องหมายให้ตรงกับสิ่งที่โจทย์ถาม"},
        {"type": "mini_quiz", "title": "ลองทำดู", "question": quiz[0], "choices": [str(int(quiz[1]) - 2), str(int(quiz[1]) - 1), quiz[1], str(int(quiz[1]) + 2)], "correct_answer": quiz[1], "answer": quiz[1], "explanation": f"คำตอบคือ {quiz[1]}"},
    ]


def ep_blocks(lesson_id: str, title: str) -> list[dict[str, Any]]:
    if is_decimal(lesson_id):
        return [
            {"type": "story_intro", "title": "Think Story", "content": "A notebook costs 23.75 baht. You pay 50 baht. How much change should you get?"},
            {"type": "visual_thinking", "title": "Look First", "content": "Check the paid money, the price, and the change.", "data": {"paid": 50, "price": 23.75, "change": 26.25, "description_th": "Change = paid money - price"}},
            {"type": "model_diagram", "title": "Use a Model", "description": "50 baht is split into 23.75 baht price and 26.25 baht change.", "model_type": "bar_model", "groups": [{"label": "price", "value": 23.75}, {"label": "change", "value": 26.25}]},
            {"type": "number_sentence", "title": "Number Sentence", "expression": "50 - 23.75 = 26.25 baht", "content": "Line up decimal points, then subtract."},
            {"type": "mini_quiz", "title": "Try It", "question": "You pay 50 baht for an item that costs 23.75 baht. What is the change?", "choices": ["24.25 baht", "25.25 baht", "26.25 baht", "27.25 baht"], "correct_answer": "26.25 baht", "answer": "26.25 baht", "explanation": "50.00 - 23.75 = 26.25 baht"},
        ]
    if is_multi_step(lesson_id):
        return [
            {"type": "story_intro", "title": "Think Story", "content": "A juice shop sells 8 cups for 15 baht each. The cost is 6 baht each. Find the profit."},
            {"type": "visual_thinking", "title": "Look First", "content": "Find sales first, then cost, then profit."},
            {"type": "model_diagram", "title": "Use a Model", "description": "Step by step: sales, cost, profit.", "model_type": "multi_step_model", "step1": {"label": "sales", "expression": "15 × 8", "result": "120 baht"}, "step2": {"label": "cost", "expression": "6 × 8", "result": "48 baht"}, "step3": {"label": "profit", "expression": "120 - 48", "result": "72 baht"}},
            {"type": "number_sentence", "title": "Number Sentence", "expression": "(15 × 8) - (6 × 8) = 72 baht", "content": "Solve one small step at a time."},
            {"type": "mini_quiz", "title": "Try It", "question": "Sell 5 snacks for 10 baht each. Cost is 4 baht each. What is the profit?", "choices": ["20 baht", "25 baht", "30 baht", "50 baht"], "correct_answer": "30 baht", "answer": "30 baht", "explanation": "Sales 5×10=50, cost 5×4=20, profit 50-20=30"},
        ]
    return [
        {"type": "story_intro", "title": "Think Story", "content": f"Read the problem about {title}. Find the important numbers first."},
        {"type": "visual_thinking", "title": "Look First", "content": "Circle what you know and underline what the question asks."},
        {"type": "model_diagram", "title": "Use a Model", "description": "Use equal groups or boxes to organize the numbers.", "model_type": "array_model", "rows": 4, "cols": 6, "total": 24, "unit": "items"},
        {"type": "number_sentence", "title": "Number Sentence", "expression": "6 × 4 = 24", "content": "Choose the operation that matches the question."},
        {"type": "mini_quiz", "title": "Try It", "question": "There are 6 groups with 4 items in each group. How many items are there?", "choices": ["20", "22", "24", "26"], "correct_answer": "24", "answer": "24", "explanation": "6 × 4 = 24"},
    ]


def repair_lesson(path: Path) -> bool:
    payload = read_json(path)
    if not payload:
        return False
    language = language_for(path, payload)
    lesson_id = str(payload.get("lesson_id") or payload.get("id") or path.stem)
    title = title_for(payload, language)
    blocks = ep_blocks(lesson_id, title) if language == "EP" else th_blocks(lesson_id, title)
    payload["lesson_id"] = lesson_id
    payload["id"] = lesson_id
    payload["grade_level"] = int(payload.get("grade_level") or grade_from_path(path))
    payload["program_type"] = "EP" if language == "EP" else "THP"
    payload["has_test"] = True
    payload["visual_blocks"] = blocks
    variants = payload.get("lesson_variants")
    if not isinstance(variants, list) or not variants:
        variants = [{"variant_id": "v01", "variant_title_th": title, "story_theme_th": title}]
    for index, variant in enumerate(variants, start=1):
        if not isinstance(variant, dict):
            continue
        variant.setdefault("variant_id", f"v{index:02d}")
        variant["visual_blocks"] = blocks
    payload["lesson_variants"] = variants
    if language == "EP":
        payload["title_en"] = str(payload.get("title_en") or title)
        payload["objective_en"] = str(payload.get("objective_en") or f"Learn and practice {title} with clear steps.")
        payload["story_intro_th"] = payload.get("story_intro_th") or blocks[0]["content"]
    else:
        payload["objective_th"] = str(payload.get("objective_th") or f"เข้าใจเรื่อง {title} และฝึกทำโจทย์ได้เป็นขั้นตอน")
    write_json(path, payload)
    return True


def make_choices(answer: float, unit: str = "") -> list[str]:
    if answer == int(answer):
        offsets = [-2, -1, 0, 2]
        values = [answer + offset for offset in offsets]
    else:
        values = [answer - 1, answer - 0.5, answer, answer + 0.75]
    choices = []
    for value in values:
        text = f"{value:.2f}".rstrip("0").rstrip(".")
        choices.append(f"{text}{unit}")
    return choices


def qrow(lesson_id: str, grade: int, index: int, question: str, answer: float | str, explanation: str, *, language: str) -> dict[str, Any]:
    unit = ""
    answer_text = str(answer)
    if isinstance(answer, (int, float)):
        answer_text = f"{answer:.2f}".rstrip("0").rstrip(".")
    choices = make_choices(float(answer), unit) if isinstance(answer, (int, float)) else [answer_text, f"{answer_text}0", f"{answer_text}1", f"{answer_text}2"]
    if answer_text not in choices:
        choices[2] = answer_text
    return {
        "question_id": f"{lesson_id}_q{index:03d}",
        "grade_level": grade,
        "lesson_id": lesson_id,
        "topic_code": lesson_id,
        "skill_code": lesson_id,
        "question_type": "challenge" if index in {5, 10} else "core",
        "routine_level": "non_routine" if index in {5, 10} else "routine",
        "difficulty": "medium" if index in {4, 5, 9, 10} else "easy",
        "confidence_role": "stretch_thinking" if index in {5, 10} else "build_confidence",
        "question_text_th": question,
        "question_text_en": question if language == "EP" else "",
        "choices": choices,
        "correct_answer": answer_text,
        "explanation_th": explanation,
        "explanation_en": explanation if language == "EP" else "",
        "hint_th": "Write the number sentence first." if language == "EP" else "เขียนประโยคคณิตก่อน แล้วค่อยคำนวณ",
        "solution_strategy_th": "step_by_step",
        "singapore_math_model": "bar_model" if is_multi_step(lesson_id) or is_decimal(lesson_id) else "array_model",
        "common_wrong_reason_th": "Check the operation and place value.",
    }


def question_rows(lesson_id: str, grade: int, language: str) -> list[dict[str, Any]]:
    if is_decimal(lesson_id):
        examples = [
            ("50 - 23.75 = ?", 26.25, "50.00 - 23.75 = 26.25"),
            ("12.35 + 7.82 = ?", 20.17, "Line up decimal points: 12.35 + 7.82 = 20.17"),
            ("15.50 - 8.25 = ?", 7.25, "15.50 - 8.25 = 7.25"),
            ("3.5 + 2.4 = ?", 5.9, "3.5 + 2.4 = 5.9"),
            ("100 - 64.80 = ?", 35.2, "100.00 - 64.80 = 35.20"),
            ("4.25 + 1.75 = ?", 6.0, "4.25 + 1.75 = 6.00"),
            ("9.60 / 1.2 = ?", 8.0, "9.6 divided by 1.2 equals 8"),
            ("2.5 x 4 = ?", 10.0, "2.5 x 4 = 10"),
            ("7.45 - 2.30 = ?", 5.15, "7.45 - 2.30 = 5.15"),
            ("23.75 + 26.25 = ?", 50.0, "23.75 + 26.25 = 50"),
        ]
    elif is_multi_step(lesson_id):
        examples = [
            ("Sell 8 cups at 15 baht each. Cost is 6 baht each. Profit?", 72, "Sales 15x8=120, cost 6x8=48, profit 120-48=72"),
            ("Buy 5 pens at 12 baht and 3 erasers at 8 baht. Total?", 84, "5x12=60 and 3x8=24, total 84"),
            ("Have 50 oranges. Give 7 friends 5 each. Left?", 15, "7x5=35, 50-35=15"),
            ("4 boxes have 6 books each, then add 5 books. Total?", 29, "4x6=24, 24+5=29"),
            ("A ticket is 20 baht. Buy 6 tickets and get 30 baht back from 150. Correct change?", 30, "Cost 20x6=120, change 150-120=30"),
            ("3 bags have 9 marbles each. Give away 8. Left?", 19, "3x9=27, 27-8=19"),
            ("5 rows of 7 chairs plus 4 extra chairs. Total?", 39, "5x7=35, 35+4=39"),
            ("A shop sells 9 items at 11 baht. Cost is 5 baht each. Profit?", 54, "Sales 99, cost 45, profit 54"),
            ("There are 6 packs of 8 stickers. Use 13 stickers. Left?", 35, "6x8=48, 48-13=35"),
            ("Buy 4 notebooks at 18 baht and pay 100 baht. Change?", 28, "4x18=72, 100-72=28"),
        ]
    elif is_geometry(lesson_id):
        examples = [
            ("Area of a rectangle 5 by 6?", 30, "Area = 5 x 6 = 30"),
            ("Area of a rectangle 4 by 7?", 28, "Area = 4 x 7 = 28"),
            ("Perimeter of a rectangle 5 by 3?", 16, "Perimeter = 5+3+5+3 = 16"),
            ("Volume of a box 3 by 4 by 2?", 24, "Volume = 3 x 4 x 2 = 24"),
            ("A square has side 8. What is its perimeter?", 32, "8 x 4 = 32"),
            ("Area of a rectangle 9 by 2?", 18, "9 x 2 = 18"),
            ("Volume of a box 5 by 2 by 3?", 30, "5 x 2 x 3 = 30"),
            ("A rectangle is 10 by 4. What is the perimeter?", 28, "10+4+10+4 = 28"),
            ("Area of a square side 6?", 36, "6 x 6 = 36"),
            ("Volume of a box 4 by 4 by 4?", 64, "4 x 4 x 4 = 64"),
        ]
    elif is_division(lesson_id):
        examples = [(f"{grade * i} / {grade} = ?", i, f"{grade * i} / {grade} = {i}") for i in range(1, 11)]
    elif is_multiply(lesson_id):
        examples = [(f"{grade} x {i} = ?", grade * i, f"{grade} x {i} = {grade * i}") for i in range(1, 11)]
    else:
        examples = [(f"{grade * 10 + i} + {grade} = ?", grade * 10 + i + grade, f"{grade * 10 + i} + {grade} = {grade * 10 + i + grade}") for i in range(1, 11)]
    return [qrow(lesson_id, grade, index, question, answer, explanation, language=language) for index, (question, answer, explanation) in enumerate(examples, start=1)]


def repair_question_bank(path: Path, lesson_id: str, grade: int, language: str) -> None:
    rows = question_rows(lesson_id, grade, language)
    write_jsonl(path, rows)


def ensure_ep_lessons() -> int:
    created = 0
    th_files = [path for path in lesson_files() if not path.stem.endswith("_ep")]
    existing = {path.stem for path in lesson_files()}
    for path in th_files:
        payload = read_json(path)
        if not payload:
            continue
        lesson_id = str(payload.get("lesson_id") or path.stem)
        ep_id = f"{lesson_id}_ep"
        if ep_id in existing:
            continue
        ep_path = path.with_name(f"{ep_id}.json")
        ep_payload = dict(payload)
        ep_payload["lesson_id"] = ep_id
        ep_payload["id"] = ep_id
        ep_payload["program_type"] = "EP"
        ep_payload["title_en"] = str(ep_payload.get("title_en") or ep_payload.get("title_th") or lesson_id).replace("ป.", "Grade ")
        ep_payload["objective_en"] = f"Learn {ep_payload['title_en']} with simple steps and practice."
        ep_payload["story_intro_th"] = f"Practice {ep_payload['title_en']} with a clear model and short questions."
        write_json(ep_path, ep_payload)
        existing.add(ep_id)
        created += 1
    return created


def main() -> None:
    created_ep = ensure_ep_lessons()
    repaired_lessons = 0
    repaired_tests = 0
    for path in lesson_files():
        payload = read_json(path)
        if not payload:
            continue
        language = language_for(path, payload)
        lesson_id = str(payload.get("lesson_id") or path.stem)
        grade = int(payload.get("grade_level") or grade_from_path(path))
        if repair_lesson(path):
            repaired_lessons += 1
        qbank = CONTENT_ROOT / "question_banks" / f"grade_{grade}" / f"{lesson_id}.jsonl"
        repair_question_bank(qbank, lesson_id, grade, language)
        repaired_tests += 1
    print(
        json.dumps(
            {
                "created_ep_lessons": created_ep,
                "repaired_lessons": repaired_lessons,
                "repaired_question_banks": repaired_tests,
                "backup_root": str(BACKUP_ROOT),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
