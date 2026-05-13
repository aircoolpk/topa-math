# -*- coding: utf-8 -*-
"""Generate lesson_variants for all 7 G1 lessons."""
import json
import os

LESSONS_DIR = r"D:\web app\4-craft.com\apps\api\app\content\math\grade_1\lessons"

LESSONS = [
    "g1_counting_numbers",
    "g1_add_within_20",
    "g1_subtract_within_20",
    "g1_compare_numbers",
    "g1_shapes_basic",
    "g1_money_basic",
    "g1_time_basic",
]

THEMES = [
    "🏫 โรงเรียน",
    "🍎 ผลไม้",
    "🧸 ของเล่น",
    "🏪 ตลาด",
    "🐕 สัตว์เลี้ยง",
    "🌻 สวน",
    "🎨 วาดรูป",
    "📚 ห้องเรียน",
    "🎮 สนุกกับเพื่อน",
    "🎉 งานเทศกาล",
]

MODEL_TYPES = ["ten_frame", "bar_model", "shape_visual"]


def gen_step_cards(lesson_id, variant_num):
    steps_map = {
        "g1_counting_numbers": ["นับทีละชิ้น", "ชี้ไปที่ของแต่ละชิ้น", "บอกจำนวนรวม"],
        "g1_add_within_20": ["ดูจำนวนก่อน", "นับรวมของที่เพิ่ม", "รวมเป็นคำตอบ"],
        "g1_subtract_within_20": ["ดูจำนวนเริ่มต้น", "ลบออกทีละขั้น", "บอกจำนวนที่เหลือ"],
        "g1_compare_numbers": ["ดูจำนวนทั้งสอง", "เปรียบเทียบเลข", "บอกว่ามากกว่า/น้อยกว่า/เท่ากัน"],
        "g1_shapes_basic": ["ดูรูปร่าง", "จำชื่อรูป", "บอกจำนวนด้าน/มุม"],
        "g1_money_basic": ["ดูเงินเหรียญ", "บวกค่าเงิน", "บอกจำนวนเงินรวม"],
        "g1_time_basic": ["ดูเข็มนาฬิกา", "อ่านตัวเลขชั่วโมง", "บอกเวลา"],
    }
    return steps_map.get(lesson_id, ["ขั้น 1", "ขั้น 2", "ขั้น 3"])


def gen_expression(lesson_id):
    expr_map = {
        "g1_counting_numbers": "5 + 0 = 5",
        "g1_add_within_20": "8 + 7 = 15",
        "g1_subtract_within_20": "12 - 4 = 8",
        "g1_compare_numbers": "9 > 5",
        "g1_shapes_basic": "3 + 2 = 5 (ด้าน)",
        "g1_money_basic": "5 + 2 + 1 = 8 (บาท)",
        "g1_time_basic": "3 + 0 = 3 (โมง)",
    }
    return expr_map.get(lesson_id, "3 + 2 = 5")


def gen_worked_example(lesson_id):
    examples_map = {
        "g1_counting_numbers": {
            "question_th": "มีลูกบอล 5 ลูกในตะกร้า มีกี่ลูก?",
            "solution_steps": ["นับทีละลูก: หนึ่ง สอง สาม สี่ ห้า", "ลูกบอลทั้งหมด 5 ลูก"],
            "answer_th": "มีลูกบอล 5 ลูก ✅",
        },
        "g1_add_within_20": {
            "question_th": "มีแอปเปิ้ล 8 ลูก ได้เพิ่มอีก 7 ลูก รวมกี่ลูก?",
            "solution_steps": ["นับ 8 ลูกก่อน", "นับต่ออีก 7 ลูก", "รวมได้ 15 ลูก"],
            "answer_th": "รวมแอปเปิ้ล 15 ลูก ✅",
        },
        "g1_subtract_within_20": {
            "question_th": "มีลูกชิ้น 12 ลูก กินไป 4 ลูก เหลือกี่ลูก?",
            "solution_steps": ["มีลูกชิ้น 12 ลูก", "กินไป 4 ลูก", "เหลือ 8 ลูก"],
            "answer_th": "เหลือลูกชิ้น 8 ลูก ✅",
        },
        "g1_compare_numbers": {
            "question_th": "8 กับ 5 อันไหนมากกว่า?",
            "solution_steps": ["ดูเลข 8 และ 5", "8 มากกว่า 5", "ตอบ 8 มากกว่า 5"],
            "answer_th": "8 มากกว่า 5 ✅",
        },
        "g1_shapes_basic": {
            "question_th": "รูปสามเหลี่ยมมีกี่มุม?",
            "solution_steps": ["นับมุมทีละมุม", "มุมที่หนึ่ง มุมที่สอง มุมที่สาม", "รูปสามเหลี่ยมมี 3 มุม"],
            "answer_th": "รูปสามเหลี่ยมมี 3 มุม ✅",
        },
        "g1_money_basic": {
            "question_th": "เหรียญ 5 บาท 2 เหรียญ กับเหรียญ 2 บาท 1 เหรียญ รวมเท่าไร?",
            "solution_steps": ["เหรียญ 5 บาท 2 เหรียญ = 10 บาท", "เหรียญ 2 บาท 1 เหรียญ = 2 บาท", "รวม 12 บาท"],
            "answer_th": "รวม 12 บาท ✅",
        },
        "g1_time_basic": {
            "question_th": "นาฬิกาบอกเวลา 3 โมง ถ้าเล่นไปอีก 2 ชั่วโมง บอกกี่โมง?",
            "solution_steps": ["เริ่มต้น 3 โมง", "บวกเพิ่มอีก 2 ชั่วโมง", "ได้ 5 โมง"],
            "answer_th": "ได้ 5 โมง ✅",
        },
    }
    return examples_map.get(lesson_id, {
        "question_th": "คำถามตัวอย่าง?",
        "solution_steps": ["ขั้น 1", "ขั้น 2", "ขั้น 3"],
        "answer_th": "คำตอบ ✅",
    })


def gen_model_block(model_type, lesson_id):
    if model_type == "ten_frame":
        return {
            "type": "ten_frame",
            "title": "🟦 ลองใช้ Ten Frame",
            "rows": 2,
            "cols": 5,
            "filled": 7,
            "total": 10,
        }
    elif model_type == "bar_model":
        return {
            "type": "bar_model",
            "title": "📊 ลองใช้ Bar Model",
            "total": 15,
            "parts": [8, 7],
            "label": "รวม",
        }
    else:
        return {
            "type": "shape_visual",
            "title": "🔷 ลองใช้ Shape Visual",
            "shapes": ["▲", "●", "■", "◆", "★"],
            "count": 5,
        }


def gen_variant(lesson_id, variant_num, theme):
    variant_id = f"v{variant_num:02d}"
    model_type = MODEL_TYPES[(variant_num - 1) % 3]

    # Story intro based on lesson and theme
    intro_map = {
        "g1_counting_numbers": f"{theme} 🌟 วันนี้เรามานับสิ่งของกันเถอะ! มีของมากมายรอให้เรานับเลขนะ",
        "g1_add_within_20": f"{theme} 🌟 มาเรียนรู้การบวกเลขกันดีกว่า! ของเยอะขึ้นต้องบวกเพิ่มนะ",
        "g1_subtract_within_20": f"{theme} 🌟 วันนี้เราจะเรียนเรื่องการลบ! ของหายไปต้องลบออกนะ",
        "g1_compare_numbers": f"{theme} 🌟 มาเปรียบเทียบจำนวนกันเถอะ! อันไหนมากกว่า อันไหนน้อยกว่า",
        "g1_shapes_basic": f"{theme} 🌟 วันนี้เราจะเรียนรู้รูปร่างต่างๆ! รูปร่างมีหลายแบบมากนะ",
        "g1_money_basic": f"{theme} 🌟 มาเรียนรู้เรื่องเงินกันดีกว่า! เงินมีหลายเหรียญต้องบวกกันนะ",
        "g1_time_basic": f"{theme} 🌟 วันนี้เราจะเรียนเรื่องเวลา! นาฬิกาบอกเวลาอย่างไรนะ",
    }
    story_intro = intro_map.get(lesson_id, f"{theme} 🌟 มาเรียนรู้กันเถอะ!")

    # Emoji counter items
    before_items = ["⭐"] * (variant_num + 2)
    added_items = ["🌟"] * (variant_num % 3 + 1)
    before_str = "".join(before_items)
    added_str = "".join(added_items)
    counter_question = f"มี {before_str} อยู่ {len(before_items)} อัน เพิ่มอีก {len(added_items)} อัน รวมกี่อัน?"

    # Mini quiz
    quiz_choices = ["A", "B", "C", "D"]
    answers = {0: "A", 1: "B", 2: "C", 3: "D"}
    answer_idx = (variant_num - 1) % 4
    quiz_map = {
        "g1_counting_numbers": (
            f"มีลูกบอล {4 + variant_num} ลูก เพิ่มอีก 3 ลูก รวมกี่ลูก?",
            f"มีลูกบอล {4 + variant_num + 3} ลูก",
        ),
        "g1_add_within_20": (
            f"5 + {variant_num + 3} = ?",
            f"คำตอบคือ {5 + variant_num + 3}",
        ),
        "g1_subtract_within_20": (
            f"{12 + variant_num} - 4 = ?",
            f"คำตอบคือ {8 + variant_num}",
        ),
        "g1_compare_numbers": (
            f"8 กับ {variant_num + 3} อันไหนมากกว่า?",
            "8 มากกว่า" if 8 > variant_num + 3 else f"{variant_num + 3} มากกว่า 8",
        ),
        "g1_shapes_basic": (
            "รูปสามเหลี่ยมมีกี่ด้าน?",
            "3 ด้าน",
        ),
        "g1_money_basic": (
            f"เหรียญ 5 บาท {variant_num} เหรียญ รวมเท่าไร?",
            f"{5 * variant_num} บาท",
        ),
        "g1_time_basic": (
            "นาฬิกาบอก 3 โมง อีก 2 ชั่วโมง บอกกี่โมง?",
            "5 โมง",
        ),
    }
    quiz_q, quiz_exp = quiz_map.get(lesson_id, ("คำถามทดสอบ?", "คำตอบ"))

    blocks = [
        {
            "type": "story_intro",
            "title": "🐣 เรื่องราวชวนคิด",
            "content": story_intro,
        },
        {
            "type": "emoji_counter",
            "title": "👀 มองภาพก่อน",
            "items_before": before_str,
            "items_added": added_str,
            "question": counter_question,
        },
        gen_model_block(model_type, lesson_id),
        {
            "type": "step_cards",
            "title": "📝 คิดทีละขั้น",
            "steps": gen_step_cards(lesson_id, variant_num),
        },
        {
            "type": "number_sentence",
            "title": "✍️ เขียนเป็นประโยคคณิต",
            "expression": gen_expression(lesson_id),
        },
        {
            "type": "worked_example",
            "title": "✅ ตัวอย่าง",
            **gen_worked_example(lesson_id),
        },
        {
            "type": "common_mistakes",
            "title": "⚠️ ระวังจุดพลาด",
            "items": [
                "นับของซ้ำ ทำให้จำนวนมากเกินจริง",
                "ข้ามของไป ทำให้จำนวนน้อยกว่าจริง",
                "สลับลำดับตัวเลข ทำให้คำตอบผิด",
            ],
        },
        {
            "type": "mini_quiz",
            "title": "🎯 ลองทำดู",
            "question": quiz_q,
            "choices": quiz_choices,
            "answer": answers[answer_idx],
            "explanation": quiz_exp,
        },
    ]

    return {
        "variant_id": variant_id,
        "variant_title_th": f"แบบฝึก {variant_num} — {theme}",
        "story_theme_th": theme,
        "visual_blocks": blocks,
    }


def main():
    for lesson_key in LESSONS:
        filepath = os.path.join(LESSONS_DIR, f"{lesson_key}.json")
        with open(filepath, "r", encoding="utf-8") as f:
            lesson = json.load(f)

        variants = []
        for i in range(1, 11):
            theme = THEMES[i - 1]
            variants.append(gen_variant(lesson_key, i, theme))

        lesson["lesson_variants"] = variants

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(lesson, f, ensure_ascii=False, indent=2)

        print(f"[OK] Updated {lesson_key}.json with {len(variants)} variants")

    print("\n[ALL DONE] All 7 lessons updated with 10 variants each!")


if __name__ == "__main__":
    main()