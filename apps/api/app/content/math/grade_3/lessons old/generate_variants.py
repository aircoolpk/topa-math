import json
import os

LESSONS_DIR = r"D:\web app\4-craft.com\apps\api\app\content\math\grade_3\lessons"

LESSON_FILES = [
    "g3_multiplication_multi_digit.json",
    "g3_division_intro.json",
    "g3_fractions_intro.json",
    "g3_multi_step_word_problems.json",
    "g3_measurement.json",
    "g3_area_intro.json",
    "g3_mixed_review.json",
]

THEMES = [
    ("🏫", "โรงเรียน"),
    ("🍎", "ผลไม้"),
    ("🧸", "ของเล่น"),
    ("🏪", "ตลาด"),
    ("🐕", "สัตว์เลี้ยง"),
    ("🌻", "สวน"),
    ("🎨", "วาดรูป"),
    ("📚", "ห้องเรียน"),
    ("🎮", "สนุกกับเพื่อน"),
    ("🎉", "งานเทศกาล"),
]

# Model types for each lesson
LESSON_MODEL = {
    "g3_multiplication_multi_digit": "array_model",
    "g3_division_intro": "grouping_model",
    "g3_fractions_intro": "fraction_visual",
    "g3_multi_step_word_problems": "bar_model",
    "g3_measurement": "ten_frame",
    "g3_area_intro": "area_model",
    "g3_mixed_review": "bar_model",
}


def generate_array_model(lesson_id, theme_emoji, theme_name):
    """Generate array_model block for multiplication lessons."""
    if lesson_id == "g3_multiplication_multi_digit":
        return {
            "type": "array_model",
            "title": "🟦 ลองใช้ Model",
            "description": f"ใช้แผ่นตารางจัดกลุ่ม {theme_emoji}",
            "grid_rows": 3,
            "grid_cols": 4,
            "shaded": 12,
            "total": 12,
        }
    elif lesson_id == "g3_mixed_review":
        return {
            "type": "array_model",
            "title": "🟦 ลองใช้ Model",
            "description": f"ใช้แผ่นตารางจัดกลุ่ม {theme_emoji}",
            "grid_rows": 4,
            "grid_cols": 5,
            "shaded": 14,
            "total": 20,
        }
    return {
        "type": "array_model",
        "title": "🟦 ลองใช้ Model",
        "description": f"ใช้แผ่นตารางจัดกลุ่ม {theme_emoji}",
        "grid_rows": 3,
        "grid_cols": 3,
        "shaded": 9,
        "total": 9,
    }


def generate_ten_frame(lesson_id, theme_emoji, theme_name):
    """Generate ten_frame block for measurement lessons."""
    return {
        "type": "ten_frame",
        "title": "🟦 ลองใช้ Model",
        "description": f"ใช้ตารางสิบช่องนับจำนวน {theme_emoji}",
        "filled": 7,
        "total": 10,
    }


def generate_bar_model(lesson_id, theme_emoji, theme_name):
    """Generate bar_model block for word problems."""
    return {
        "type": "bar_model",
        "title": "🟦 ลองใช้ Model",
        "description": f"ใช้แผนภูมิแท่งวิเคราะห์โจทย์ {theme_emoji}",
        "segments": [
            {"label": "ส่วนที่ 1", "value": 15, "color": "#FF6B6B"},
            {"label": "ส่วนที่ 2", "value": 8, "color": "#4ECDC4"},
        ],
    }


def generate_grouping_model(lesson_id, theme_emoji, theme_name):
    """Generate grouping_model block for division lessons."""
    return {
        "type": "grouping_model",
        "title": "🟦 ลองใช้ Model",
        "description": f"ใช้การจัดกลุ่มแบ่งทีละเท่าๆ กัน {theme_emoji}",
        "total_items": 24,
        "groups": 4,
        "items_per_group": 6,
    }


def generate_fraction_visual(lesson_id, theme_emoji, theme_name):
    """Generate fraction_visual block for fractions lessons."""
    return {
        "type": "fraction_visual",
        "title": "🟦 ลองใช้ Model",
        "description": f"แบ่งพื้นที่เป็นส่วนเท่าๆ กัน {theme_emoji}",
        "whole": 8,
        "shaded": 3,
        "denominator": 4,
    }


def generate_area_model(lesson_id, theme_emoji, theme_name):
    """Generate area_model block for area lessons."""
    return {
        "type": "area_model",
        "title": "🟦 ลองใช้ Model",
        "description": f"วัดพื้นที่โดยนับช่องตาราง {theme_emoji}",
        "width": 5,
        "height": 3,
        "unit": "ช่อง",
    }


def generate_variant(lesson_id, variant_num, theme_emoji, theme_name):
    """Generate a single variant with all required blocks."""
    vid = f"v{variant_num:02d}"
    
    # Choose the appropriate model block
    model_type = LESSON_MODEL.get(lesson_id, "bar_model")
    
    if model_type == "array_model":
        model_block = generate_array_model(lesson_id, theme_emoji, theme_name)
    elif model_type == "ten_frame":
        model_block = generate_ten_frame(lesson_id, theme_emoji, theme_name)
    elif model_type == "bar_model":
        model_block = generate_bar_model(lesson_id, theme_emoji, theme_name)
    elif model_type == "grouping_model":
        model_block = generate_grouping_model(lesson_id, theme_emoji, theme_name)
    elif model_type == "fraction_visual":
        model_block = generate_fraction_visual(lesson_id, theme_emoji, theme_name)
    elif model_type == "area_model":
        model_block = generate_area_model(lesson_id, theme_emoji, theme_name)
    else:
        model_block = generate_bar_model(lesson_id, theme_emoji, theme_name)

    # Generate story intro based on theme and lesson
    story_intros = {
        "g3_multiplication_multi_digit": f"{theme_emoji} {theme_name}: นักเรียนในห้องเรียนแต่ละคนได้รับของใช้จำนวนเท่ากัน ลองมาคูณกันเถอะ!",
        "g3_division_intro": f"{theme_emoji} {theme_name}: มีของหลายชิ้นต้องแบ่งให้เพื่อนๆ อย่างละเท่าๆ กัน ลองมาหารกัน!",
        "g3_fractions_intro": f"{theme_emoji} {theme_name}: พิซซ่าหรือขนมเค้กถูกแบ่งเป็นส่วนเท่าๆ กัน มาดูกันว่าเศษส่วนเป็นอย่างไร!",
        "g3_multi_step_word_problems": f"{theme_emoji} {theme_name}: โจทย์ปัญหาที่ต้องคิดหลายขั้นตอน มาวิเคราะห์ไปด้วยกัน!",
        "g3_measurement": f"{theme_emoji} {theme_name}: วัดความยาว ความสูง และน้ำหนักกันเถอะ!",
        "g3_area_intro": f"{theme_emoji} {theme_name}: พื้นที่ของรูปร่างต่างๆ วัดได้อย่างไร มาหาคำตอบ!",
        "g3_mixed_review": f"{theme_emoji} {theme_name}: มาทบทวนการบวก ลบ คูณ หาร ไปพร้อมๆ กัน!",
    }
    
    # Emoji counter items
    emoji_counters = {
        "g3_multiplication_multi_digit": ("🍎🍎🍎🍎🍎", "🍎🍎🍎", "มี 🍎 5 ผล ในหนึ่งถุง ถ้ามี 3 ถุง รวม 🍎 กี่ผล?"),
        "g3_division_intro": ("⭐⭐⭐⭐⭐⭐⭐⭐", "⭐⭐", "มี ⭐ 8 ดวง แบ่งให้เพื่อน 2 คน คนละกี่ดวง?"),
        "g3_fractions_intro": ("🍕🍕🍕🍕", "🍕🍕", "มี 🍕 4 ชิ้น แบ่งให้เพื่อน 2 คน คนละเท่าไหร่?"),
        "g3_multi_step_word_problems": ("🎈🎈🎈🎈🎈", "🎈🎈🎈", "มี 🎈 5 ลูก ใน 3 กล่อง รวมกี่ลูก บวกอีก 2 ลูก?"),
        "g3_measurement": ("📏📏📏📏📏📏📏", "📏📏📏", "ไม้บรรทัดยาว 7 ซม. วางเรียงกัน 3 อัน รวมกี่ ซม.?"),
        "g3_area_intro": ("⬜⬜⬜⬜⬜", "⬜⬜⬜⬜⬜", "พื้นที่สี่เหลี่ยมกว้าง 5 ช่อง สูง 3 ช่อง มีกี่ช่อง?"),
        "g3_mixed_review": ("🔴🔴🔴🔴🔴", "🔴🔴🔴🔴🔴", "มี 🔴 5 ลูก ใน 4 กล่อง รวมกี่ลูก?"),
    }
    
    # Step cards
    step_cards = {
        "g3_multiplication_multi_digit": ["เขียนตัวเลขเรียงหลัก", "คูณหลักหน่วยก่อน", "ทดตัวเลขไปหลักสิบ", "คูณหลักสิบแล้วบวกตัวทด", "ตรวจคำตอบ"],
        "g3_division_intro": ["นับจำนวนทั้งหมด", "กำหนดจำนวนกลุ่ม", "แบ่งให้เท่าๆ กัน", "นับจำนวนในแต่ละกลุ่ม", "ตรวจคำตอบโดยคูณกลับ"],
        "g3_fractions_intro": ["ดูจำนวนทั้งหมด", "แบ่งเป็นส่วนเท่าๆ กัน", "นับจำนวนส่วนที่สนใจ", "เขียนเศษส่วน", "ตรวจสอบคำตอบ"],
        "g3_multi_step_word_problems": ["อ่านโจทย์ให้เข้าใจ", "หาข้อมูลที่ต้องการ", "คิดขั้นตอนที่ 1", "คิดขั้นตอนที่ 2", "ตรวจคำตอบ"],
        "g3_measurement": ["ดูหน่วยที่ต้องวัด", "ใช้เครื่องมือวัด", "นับจำนวนหน่วย", "เขียนคำตอบพร้อมหน่วย", "ตรวจสอบความสมเหตุสมผล"],
        "g3_area_intro": ["ดูรูปร่างพื้นที่", "นับช่องกว้าง", "นับช่องสูง", "คูณกว้าง × สูง", "ตรวจคำตอบโดยนับช่องจริง"],
        "g3_mixed_review": ["อ่านโจทย์", "บอกว่าใช้บวก ลบ คูณ หรือ หาร", "คำนวณขั้นที่ 1", "คำนวณขั้นที่ 2 (ถ้ามี)", "ตรวจคำตอบ"],
    }
    
    # Number sentences
    number_sentences = {
        "g3_multiplication_multi_digit": "5 × 3 = ?",
        "g3_division_intro": "8 ÷ 2 = ?",
        "g3_fractions_intro": "4 ÷ 2 = 2 หรือ 4/2 = 2",
        "g3_multi_step_word_problems": "(5 × 3) + 2 = ?",
        "g3_measurement": "7 × 3 = ? ซม.",
        "g3_area_intro": "5 × 3 = ? ช่อง",
        "g3_mixed_review": "4 × 5 = ?",
    }
    
    # Worked examples
    worked_examples = {
        "g3_multiplication_multi_digit": {
            "question_th": "🍎 5 ผล × 3 ถุง = ?",
            "solution_steps": ["5 × 3 = 15", "ดังนั้นมี 🍎 ทั้งหมด 15 ผล"],
            "answer_th": "15 ผล",
        },
        "g3_division_intro": {
            "question_th": "⭐ 8 ดวง แบ่งให้เพื่อน 2 คน = ?",
            "solution_steps": ["8 ÷ 2 = 4", "แต่ละคนได้ ⭐ 4 ดวง"],
            "answer_th": "4 ดวงต่อคน",
        },
        "g3_fractions_intro": {
            "question_th": "🍕 4 ชิ้น แบ่ง 2 คน = ?",
            "solution_steps": ["4 ÷ 2 = 2", "แต่ละคนได้ 2/4 = 1/2 ของพิซซ่า"],
            "answer_th": "1/2 หรือ 2 ชิ้น",
        },
        "g3_multi_step_word_problems": {
            "question_th": "🎈 5 ลูก × 3 กล่อง + 2 ลูก = ?",
            "solution_steps": ["5 × 3 = 15", "15 + 2 = 17", "รวม 🎈 ทั้งหมด 17 ลูก"],
            "answer_th": "17 ลูก",
        },
        "g3_measurement": {
            "question_th": "📏 7 ซม. × 3 อัน = ?",
            "solution_steps": ["7 × 3 = 21", "ไม้บรรทัดรวมยาว 21 ซม."],
            "answer_th": "21 ซม.",
        },
        "g3_area_intro": {
            "question_th": "พื้นที่กว้าง 5 ช่อง สูง 3 ช่อง = ?",
            "solution_steps": ["5 × 3 = 15", "พื้นที่มี 15 ช่อง"],
            "answer_th": "15 ตารางช่อง",
        },
        "g3_mixed_review": {
            "question_th": "🔴 4 ลูก × 5 กล่อง = ?",
            "solution_steps": ["4 × 5 = 20", "รวม 🔴 20 ลูก"],
            "answer_th": "20 ลูก",
        },
    }
    
    # Common mistakes
    common_mistakes = {
        "g3_multiplication_multi_digit": [
            "❌ ลืมทดตัวเลขไปบวกกับหลักถัดไป",
            "❌ คูณหลักเดียวแล้วลืมอีกหลัก",
            "✅ คูณทีละหลัก จากขวาไปซ้าย อย่าลืมทด",
        ],
        "g3_division_intro": [
            "❌ แบ่งไม่เท่ากันในแต่ละกลุ่ม",
            "❌ ลืมตรวจโดยคูณกลับ",
            "✅ แบ่งให้เท่าๆ กันทุกกลุ่ม แล้วตรวจโดยคูณกลับ",
        ],
        "g3_fractions_intro": [
            "❌ ส่วน (ตัวส่วน) กับ เศษ (ตัวเศษ) สลับกัน",
            "❌ คิดว่าเศษส่วนเหมือนการหารเสมอ",
            "✅ ตัวส่วนบอกว่าแบ่งเป็นกี่ส่วน ตัวเศษบอกว่าเอากี่ส่วน",
        ],
        "g3_multi_step_word_problems": [
            "❌ ข้ามขั้นตอน ทำทีละขั้นไม่ได้",
            "❌ ลืมบวกหรือลบตัวเลขที่เหลือ",
            "✅ ทำขั้นตอนที่ 1 ให้เสร็จก่อน แล้วค่อยทำขั้นตอนที่ 2",
        ],
        "g3_measurement": [
            "❌ ลืมใส่หน่วย หรือใช้หน่วยผิด",
            "❌ วัดผิดจุดเริ่มต้น",
            "✅ วัดจาก 0 และเขียนหน่วยให้ถูกต้อง",
        ],
        "g3_area_intro": [
            "❌ นับช่องเกินหรือขาด",
            "❌ สลับกว้างกับสูง",
            "✅ นับทุกช่องให้ครบ แล้วคูณกว้าง × สูง",
        ],
        "g3_mixed_review": [
            "❌ สับสนระหว่างบวก ลบ คูณ หาร",
            "❌ ทำขั้นตอนสลับลำดับ",
            "✅ ดูเครื่องหมายให้ชัด แล้วค่อยๆ ทำทีละขั้น",
        ],
    }
    
    # Mini quiz
    mini_quizzes = {
        "g3_multiplication_multi_digit": {
            "question": "🍎 4 ผล × 2 ถุง = ?",
            "choices": ["6 ผล", "8 ผล", "2 ผล", "12 ผล"],
            "answer": "8 ผล",
            "explanation": "4 × 2 = 8 ดังนั้นมี 🍎 ทั้งหมด 8 ผล",
        },
        "g3_division_intro": {
            "question": "⭐ 12 ดวง แบ่งให้เพื่อน 3 คน คนละกี่ดวง?",
            "choices": ["3 ดวง", "4 ดวง", "6 ดวง", "9 ดวง"],
            "answer": "4 ดวง",
            "explanation": "12 ÷ 3 = 4 ดังนั้นแต่ละคนได้ 4 ดวง",
        },
        "g3_fractions_intro": {
            "question": "🍕 6 ชิ้น แบ่งให้ 3 คน คนละเท่าไหร่?",
            "choices": ["1/6", "1/3", "2 ชิ้น", "3 ชิ้น"],
            "answer": "2 ชิ้น",
            "explanation": "6 ÷ 3 = 2 ชิ้น หรือเขียนเป็น 2/6 = 1/3",
        },
        "g3_multi_step_word_problems": {
            "question": "🎈 3 ลูก × 4 กล่อง = ? แล้วบวก 5 ลูก = ?",
            "choices": ["17 ลูก", "12 ลูก", "7 ลูก", "19 ลูก"],
            "answer": "17 ลูก",
            "explanation": "3 × 4 = 12 แล้วบวก 5 = 17 ลูก",
        },
        "g3_measurement": {
            "question": "📏 ไม้บรรทัดยาว 9 ซม. วางเรียง 2 อัน รวมกี่ ซม.?",
            "choices": ["11 ซม.", "18 ซม.", "7 ซม.", "20 ซม."],
            "answer": "18 ซม.",
            "explanation": "9 × 2 = 18 ซม.",
        },
        "g3_area_intro": {
            "question": "พื้นที่กว้าง 4 ช่อง สูง 3 ช่อง มีกี่ช่อง?",
            "choices": ["7 ช่อง", "12 ช่อง", "43 ช่อง", "34 ช่อง"],
            "answer": "12 ช่อง",
            "explanation": "4 × 3 = 12 ช่อง",
        },
        "g3_mixed_review": {
            "question": "🔴 3 ลูก × 6 กล่อง = ?",
            "choices": ["9 ลูก", "18 ลูก", "3 ลูก", "36 ลูก"],
            "answer": "18 ลูก",
            "explanation": "3 × 6 = 18 ลูก",
        },
    }

    # Build variant
    variant = {
        "variant_id": vid,
        "variant_title_th": f"{theme_emoji} {theme_name} - รูปแบบที่ {variant_num}",
        "story_theme_th": f"ธีม: {theme_name} {theme_emoji}",
        "visual_blocks": [
            {
                "type": "story_intro",
                "title": "🐣 เรื่องราวชวนคิด",
                "content": story_intros.get(lesson_id, f"{theme_emoji} {theme_name}: มาลองคิดกันเถอะ!"),
            },
            {
                "type": "emoji_counter",
                "title": "👀 มองภาพก่อน",
                "items_before": emoji_counters.get(lesson_id, ("🔵🔵🔵", "🔵🔵", "มี 🔵 กี่ชิ้น?"))[0],
                "items_added": emoji_counters.get(lesson_id, ("🔵🔵🔵", "🔵🔵", "มี 🔵 กี่ชิ้น?"))[1],
                "question": emoji_counters.get(lesson_id, ("🔵🔵🔵", "🔵🔵", "มี 🔵 กี่ชิ้น?"))[2],
            },
            model_block,
            {
                "type": "step_cards",
                "title": "📝 คิดทีละขั้น",
                "steps": step_cards.get(lesson_id, ["ขั้นตอนที่ 1", "ขั้นตอนที่ 2", "ขั้นตอนที่ 3"]),
            },
            {
                "type": "number_sentence",
                "title": "✍️ เขียนเป็นประโยคคณิต",
                "expression": number_sentences.get(lesson_id, " ? = ?"),
            },
            {
                "type": "worked_example",
                "title": "✅ ตัวอย่าง",
                "question_th": worked_examples.get(lesson_id, {"question_th": "?", "solution_steps": [], "answer_th": "?"})["question_th"],
                "solution_steps": worked_examples.get(lesson_id, {"question_th": "?", "solution_steps": [], "answer_th": "?"})["solution_steps"],
                "answer_th": worked_examples.get(lesson_id, {"question_th": "?", "solution_steps": [], "answer_th": "?"})["answer_th"],
            },
            {
                "type": "common_mistakes",
                "title": "⚠️ ระวังจุดพลาด",
                "items": common_mistakes.get(lesson_id, ["❌ พลาดที่ 1", "❌ พลาดที่ 2", "✅ วิธีแก้"]),
            },
            {
                "type": "mini_quiz",
                "title": "🎯 ลองทำดู",
                "question": mini_quizzes.get(lesson_id, {"question": "?", "choices": ["A", "B", "C", "D"], "answer": "A", "explanation": ""})["question"],
                "choices": mini_quizzes.get(lesson_id, {"question": "?", "choices": ["A", "B", "C", "D"], "answer": "A", "explanation": ""})["choices"],
                "answer": mini_quizzes.get(lesson_id, {"question": "?", "choices": ["A", "B", "C", "D"], "answer": "A", "explanation": ""})["answer"],
                "explanation": mini_quizzes.get(lesson_id, {"question": "?", "choices": ["A", "B", "C", "D"], "answer": "A", "explanation": ""})["explanation"],
            },
        ],
    }
    
    return variant


def process_lesson(filepath):
    """Read a lesson file, add variants, and save."""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    lesson_id = data["lesson_id"]
    print(f"  Processing: {lesson_id}")
    
    # Generate 10 variants
    variants = []
    for i, (emoji, name) in enumerate(THEMES, 1):
        variant = generate_variant(lesson_id, i, emoji, name)
        variants.append(variant)
    
    # Add lesson_variants to data
    data["lesson_variants"] = variants
    
    # Save updated file
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"    → Added {len(variants)} variants to {lesson_id}")
    return len(variants)


def main():
    print("🎯 Starting lesson_variants generation...\n")
    total_variants = 0
    
    for filename in LESSON_FILES:
        filepath = os.path.join(LESSONS_DIR, filename)
        print(f"Processing: {filename}")
        count = process_lesson(filepath)
        total_variants += count
        print()
    
    print(f"✅ Done! Generated {total_variants} variants across {len(LESSON_FILES)} lessons.")
    
    # Validate
    print("\n🔍 Validating...")
    for filename in LESSON_FILES:
        filepath = os.path.join(LESSONS_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        variant_count = len(data.get("lesson_variants", []))
        print(f"  {filename}: {variant_count} variants {'✅' if variant_count == 10 else '❌'}")


if __name__ == "__main__":
    main()
