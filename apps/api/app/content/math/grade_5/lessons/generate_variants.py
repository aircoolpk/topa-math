import json
import os

LESSONS_DIR = r"D:\web app\4-craft.com\apps\api\app\content\math\grade_5\lessons"

STORY_THEMES = [
    ("🏫", "โรงเรียน", "เรื่องราวในโรงเรียน"),
    ("🍎", "ผลไม้", "เรื่องราวเกี่ยวกับผลไม้"),
    ("🧸", "ของเล่น", "เรื่องราวเกี่ยวกับของเล่น"),
    ("🏪", "ตลาด", "เรื่องราวในตลาด"),
    ("🐕", "สัตว์เลี้ยง", "เรื่องราวเกี่ยวกับสัตว์เลี้ยง"),
    ("🌻", "สวน", "เรื่องราวในสวน"),
    ("🎨", "วาดรูป", "เรื่องราวเกี่ยวกับการวาดรูป"),
    ("📚", "ห้องเรียน", "เรื่องราวในห้องเรียน"),
    ("🎮", "สนุกกับเพื่อน", "เรื่องราวสนุกๆ กับเพื่อน"),
    ("🎉", "งานเทศกาล", "เรื่องราวในงานเทศกาล"),
]

def build_visual_blocks(lesson_id, theme_emoji, theme_name):
    blocks = []

    # 1. story_intro
    story_intro_templates = {
        "g5_data_graphs": f"{theme_emoji} {theme_name} มีการเก็บข้อมูลเรื่องต่างๆ มาสร้างเป็นกราฟ มาช่วยกันอ่านกราฟและหาคำตอบกันเถอะ!",
        "g5_decimals": f"{theme_emoji} {theme_name} มีรายการสินค้าและราคาที่เป็นทศนิยม ลองช่วยกันคำนวณราคารวมและเงินทอนดูสิ!",
        "g5_fraction_operations": f"{theme_emoji} {theme_name} มีการแบ่งของใช้เป็นเศษส่วน เช่น ขนม ผลไม้ หรือของใช้ต่างๆ มาช่วยกันบวก ลบ คูณ หาร เศษส่วนกัน!",
        "g5_multi_step_word_problems": f"{theme_emoji} {theme_name} มีโจทย์ปัญหาที่ต้องคิดหลายขั้นตอน ลองมาวิเคราะห์และหาคำตอบทีละขั้นกัน!",
        "g5_percent_intro": f"{theme_emoji} {theme_name} มีการลดราคา คิดภาษี หรือส่วนลดต่างๆ ที่ต้องใช้เปอร์เซ็นต์ มาช่วยกันคำนวณดู!",
        "g5_ratio_intro": f"{theme_emoji} {theme_name} มีการผสมของสองอย่างในอัตราส่วนที่เหมาะสม เช่น สูตรอาหาร หรือการผสมสี มาช่วยกันหาอัตราส่วนกัน!",
        "g5_volume_area": f"{theme_emoji} {theme_name} มีการวัดขนาดของกล่อง ตู้ปลา หรือที่เก็บของต่างๆ มาช่วยกันคำนวณปริมาตรและพื้นที่ผิวกัน!",
    }
    blocks.append({
        "block_type": "story_intro",
        "block_title_th": "🐣 เรื่องราวชวนคิด",
        "content_th": story_intro_templates.get(lesson_id, f"{theme_emoji} มาเรียนรู้เรื่องนี้กันเถอะ!"),
    })

    # 2. emoji_counter
    blocks.append({
        "block_type": "emoji_counter",
        "block_title_th": "👀 มองภาพก่อน",
        "content_th": f"ลองนับ{theme_name}ในภาพแต่ละกลุ่ม แล้วตอบคำถามด้านล่าง",
        "image_description_th": "ภาพกลุ่มของสิ่งของต่างๆ พร้อมตัวเลขให้นับ",
    })

    # 3. visual model (lesson-specific)
    visual_models = {
        "g5_data_graphs": {"block_type": "table_visual", "block_title_th": "📊 ตารางและกราฟ", "content_th": "นี่คือตารางแสดงข้อมูลจำนวนสิ่งของในแต่ละประเภท อ่านตารางแล้วตอบคำถาม"},
        "g5_decimals": {"block_type": "place_value_chart", "block_title_th": "🔢 ค่าของตัวเลข", "content_th": "ตารางค่าประจำหลักช่วยให้เข้าใจตำแหน่งของทศนิยมแต่ละหลัก"},
        "g5_fraction_operations": {"block_type": "fraction_visual", "block_title_th": "🍕 เศษส่วน", "content_th": "ภาพแบ่งวงกลมหรือสี่เหลี่ยมเป็นส่วนๆ แสดงเศษส่วนต่างๆ"},
        "g5_multi_step_word_problems": {"block_type": "bar_model", "block_title_th": "📏 แผนภาพแท่ง", "content_th": "ใช้แผนภาพแท่งช่วยจัดข้อมูลและวางแผนแก้โจทย์ทีละขั้น"},
        "g5_percent_intro": {"block_type": "bar_model", "block_title_th": "📊 แผนภาพเปอร์เซ็นต์", "content_th": "แผนภาพแท่งแสดงส่วนแบ่ง 100% ช่วยให้เห็นภาพเปอร์เซ็นต์ได้ชัดเจน"},
        "g5_ratio_intro": {"block_type": "bar_model", "block_title_th": "⚖️ อัตราส่วน", "content_th": "แผนภาพแท่งเปรียบเทียบสองจำนวนในอัตราส่วนที่กำหนด"},
        "g5_volume_area": {"block_type": "area_model", "block_title_th": "📐 แผนภาพพื้นที่", "content_th": "ภาพรูปทรงสามมิติพร้อมขนาด ช่วยให้เห็นภาพปริมาตรและพื้นที่ผิว"},
    }
    blocks.append(visual_models.get(lesson_id, {"block_type": "generic", "block_title_th": "🖼️ ภาพประกอบ", "content_th": "ภาพประกอบการเรียนรู้"}))

    # 4. step_cards
    step_cards = {
        "g5_data_graphs": [{"step_th": "ขั้นที่ 1: อ่านหัวกราฟและแกน", "detail_th": "ดูว่ากราฟแสดงข้อมูลอะไร"}, {"step_th": "ขั้นที่ 2: ดูความสูงของแท่ง", "detail_th": "ความสูงบอกจำนวน"}, {"step_th": "ขั้นที่ 3: ตอบคำถาม", "detail_th": "เปรียบเทียบหรือหาค่าเฉลี่ย"}],
        "g5_decimals": [{"step_th": "ขั้นที่ 1: เขียนเลขให้ตรงหลัก", "detail_th": "จุดทศนิยมตรงกัน"}, {"step_th": "ขั้นที่ 2: คำนวณตามเครื่องหมาย", "detail_th": "บวก ลบ คูณ หาร ตามปกติ"}, {"step_th": "ขั้นที่ 3: วางจุดทศนิยม", "detail_th": "นับตำแหน่งให้ถูกต้อง"}],
        "g5_fraction_operations": [{"step_th": "ขั้นที่ 1: ดูว่าต้องทำอะไร", "detail_th": "บวก ลบ คูณ หาร"}, {"step_th": "ขั้นที่ 2: ทำส่วนให้เท่ากัน (ถ้าบวกลบ)", "detail_th": "หา ค.ร.น. ของส่วน"}, {"step_th": "ขั้นที่ 3: คำนวณและตัดทอน", "detail_th": "ถ้าทำได้ให้ตั้ง"}],
        "g5_multi_step_word_problems": [{"step_th": "ขั้นที่ 1: อ่านโจทย์และระบุข้อมูล", "detail_th": "ขีดเส้นใต้ข้อมูลสำคัญ"}, {"step_th": "ขั้นที่ 2: วางแผนขั้นตอน", "detail_th": "เขียนลำดับการคำนวณ"}, {"step_th": "ขั้นที่ 3: คำนวณทีละขั้น", "detail_th": "ตรวจสอบทุกขั้นตอน"}],
        "g5_percent_intro": [{"step_th": "ขั้นที่ 1: เปลี่ยนเปอร์เซ็นต์เป็นเศษส่วน", "detail_th": "% ÷ 100 = เศษ/ส่วน"}, {"step_th": "ขั้นที่ 2: คูณเศษส่วนกับจำนวน", "detail_th": "หาส่วนของจำนวนนั้น"}, {"step_th": "ขั้นที่ 3: แปลงกลับถ้าต้องการ", "detail_th": "เศษส่วน → ทศนิยม หรือ บาท"}],
        "g5_ratio_intro": [{"step_th": "ขั้นที่ 1: ดูอัตราส่วนที่กำหนด", "detail_th": "a : b คืออะไรบ้าง"}, {"step_th": "ขั้นที่ 2: หาตัวคูณ", "detail_th": "ดูว่าส่วนหนึ่งถูกคูณด้วยเท่าไหร่"}, {"step_th": "ขั้นที่ 3: คูณส่วนที่เหลือ", "detail_th": "ใช้ตัวคูณเดียวกัน"}],
        "g5_volume_area": [{"step_th": "ขั้นที่ 1: ดูรูปทรงและขนาด", "detail_th": "กว้าง ยาว สูง หรือด้าน"}, {"step_th": "ขั้นที่ 2: เลือกสูตร", "detail_th": "ปริมาตร = ก×ย×ส หรือ ด³"}, {"step_th": "ขั้นที่ 3: แปลงหน่วย", "detail_th": "ลิตร = ซม.³ ÷ 1000"}],
    }
    blocks.append({
        "block_type": "step_cards",
        "block_title_th": "📝 คิดทีละขั้น",
        "steps": step_cards.get(lesson_id, [{"step_th": "ขั้นที่ 1: อ่านโจทย์", "detail_th": "ทำความเข้าใจ"}, {"step_th": "ขั้นที่ 2: วางแผน", "detail_th": "หาวิธี"}, {"step_th": "ขั้นที่ 3: คำนวณ", "detail_th": "ได้คำตอบ"}]),
    })

    # 5. number_sentence
    ns_templates = {
        "g5_data_graphs": {"block_type": "number_sentence", "block_title_th": "✍️ เขียนเป็นประโยคคณิต", "content_th": "จากข้อมูลในกราฟ เขียนประโยคคณิตหาค่าเฉลี่ย ผลรวม หรือการเปรียบเทียบ"},
        "g5_decimals": {"block_type": "number_sentence", "block_title_th": "✍️ เขียนเป็นประโยคคณิต", "content_th": "เขียนประโยคบวก ลบ คูณ หาร ทศนิยม ให้ถูกต้อง"},
        "g5_fraction_operations": {"block_type": "number_sentence", "block_title_th": "✍️ เขียนเป็นประโยคคณิต", "content_th": "เขียนประโยคบวก ลบ คูณ หาร เศษส่วน ให้ถูกต้อง"},
        "g5_multi_step_word_problems": {"block_type": "number_sentence", "block_title_th": "✍️ เขียนเป็นประโยคคณิต", "content_th": "เขียนประโยคคณิตหลายขั้นตอน เช่น (จำนวน × ราคา) - จำนวนที่เสียหาย × ราคา = กำไร"},
        "g5_percent_intro": {"block_type": "number_sentence", "block_title_th": "✍️ เขียนเป็นประโยคคณิต", "content_th": "เขียนประโยคคูณเปอร์เซ็นต์: จำนวน × เปอร์เซ็นต์ ÷ 100 = ค่าของเปอร์เซ็นต์นั้น"},
        "g5_ratio_intro": {"block_type": "number_sentence", "block_title_th": "✍️ เขียนเป็นประโยคคณิต", "content_th": "เขียนอัตราส่วน: a : b = (a×n) : (b×n) หาสมาชิกที่หายไป"},
        "g5_volume_area": {"block_type": "number_sentence", "block_title_th": "✍️ เขียนเป็นประโยคคณิต", "content_th": "เขียนสูตรปริมาตร: ก × ย × ส = ปริมาตร หรือ ด³ = ปริมาตรลูกบาศก์"},
    }
    blocks.append(ns_templates.get(lesson_id, {"block_type": "number_sentence", "block_title_th": "✍️ เขียนเป็นประโยคคณิต", "content_th": "เขียนประโยคคณิตจากโจทย์"}))

    # 6. worked_example
    worked_templates = {
        "g5_data_graphs": {"block_type": "worked_example", "block_title_th": "✅ ตัวอย่าง", "example_th": "กราฟแท่งแสดงยอดขายขนมใน 4 วัน: วันจันทร์ 150 บาท วันอังคาร 200 บาท วันพุธ 100 บาท วันพฤหัส 250 บาท วันไหนขายดีที่สุด?", "solution_th": "ดูแท่งที่สูงที่สุด = วันพฤหัส 250 บาท ✅"},
        "g5_decimals": {"block_type": "worked_example", "block_title_th": "✅ ตัวอย่าง", "example_th": "น้ำปลา 35.50 บาท + น้ำมันพืช 42.75 บาท = ?", "solution_th": "35.50 + 42.75 = 78.25 บาท ✅"},
        "g5_fraction_operations": {"block_type": "worked_example", "block_title_th": "✅ ตัวอย่าง", "example_th": "1/2 + 1/4 = ?", "solution_th": "ทำส่วนเท่า: 2/4 + 1/4 = 3/4 ✅"},
        "g5_multi_step_word_problems": {"block_type": "worked_example", "block_title_th": "✅ ตัวอย่าง", "example_th": "ซื้อของ 30 ชิ้น ชิ้นละ 25 บาท ขายชิ้นละ 40 บาท ได้กำไรเท่าไหร่?", "solution_th": "ต้นทุน: 30×25=750 / ขาย: 30×40=1200 / กำไร: 1200-750=450 บาท ✅"},
        "g5_percent_intro": {"block_type": "worked_example", "block_title_th": "✅ ตัวอย่าง", "example_th": "ราคาขนม 200 บาท ลดราคา 15% ราคาใหม่เท่าไหร่?", "solution_th": "ลด: 200×15÷100=30 บาท / ราคาใหม่: 200-30=170 บาท ✅"},
        "g5_ratio_intro": {"block_type": "worked_example", "block_title_th": "✅ ตัวอย่าง", "example_th": "อัตราส่วน 3:2 ถ้าใช้ส่วนแรก 9 ช้อน ต้องใช้ส่วนที่สองกี่ช้อน?", "solution_th": "3×3=9 ดังนั้น 2×3=6 ช้อน ✅"},
        "g5_volume_area": {"block_type": "worked_example", "block_title_th": "✅ ตัวอย่าง", "example_th": "กล่องกว้าง 10 ซม. ยาว 5 ซม. สูง 4 ซม. มีปริมาตรเท่าไหร่?", "solution_th": "10×5×4 = 200 ลูกบาศก์เซนติเมตร ✅"},
    }
    blocks.append(worked_templates.get(lesson_id, {"block_type": "worked_example", "block_title_th": "✅ ตัวอย่าง", "example_th": "ตัวอย่างโจทย์", "solution_th": "วิธีทำและคำตอบ ✅"}))

    # 7. common_mistakes
    blocks.append({
        "block_type": "common_mistakes",
        "block_title_th": "⚠️ ระวังจุดพลาด",
        "mistakes": [
            {"mistake_th": "อ่านข้อมูลผิด เช่น ดูแท่งผิดหรืออ่านตัวเลขผิด", "correct_th": "ตรวจสอบตัวเลขบนแกนทุกครั้ง"},
            {"mistake_th": "คำนวณผิดขั้นตอน ข้ามการดำเนินการบางขั้น", "correct_th": "เขียนขั้นตอนทุกบรรทัด อย่ารีบข้าม"},
            {"mistake_th": "ไม่ตรวจคำตอบว่าสมเหตุสมผลหรือไม่", "correct_th": "ประมาณคำตอบก่อนคำนวณ แล้วเช็คว่าใกล้เคียง"},
        ],
    })

    # 8. mini_quiz
    quiz_templates = {
        "g5_data_graphs": {"block_type": "mini_quiz", "block_title_th": "🎯 ลองทำดู", "question_th": f"กราฟแท่งแสดงจำนวน{theme_name}ในแต่ละวัน วันจันทร์ 80 ชิ้น วันอังคาร 120 ชิ้น วันพุธ 60 ชิ้น วันพฤหัส 100 ชิ้น ค่าเฉลี่ยต่อวันเท่าไหร่?", "choices": ["80 ชิ้น", "90 ชิ้น", "100 ชิ้น", "110 ชิ้น"], "answer": "90 ชิ้น"},
        "g5_decimals": {"block_type": "mini_quiz", "block_title_th": "🎯 ลองทำดู", "question_th": f"ซื้อ{theme_name}ราคา 23.75 บาท ให้ธนบัตร 50 บาท ได้เงินทอนเท่าไหร่?", "choices": ["25.25 บาท", "26.25 บาท", "27.25 บาท", "24.25 บาท"], "answer": "26.25 บาท"},
        "g5_fraction_operations": {"block_type": "mini_quiz", "block_title_th": "🎯 ลองทำดู", "question_th": f"มี{theme_name} 3/4 ของลูก กินไป 1/4 ของลูก เหลือเท่าไหร่?", "choices": ["1/4", "1/2", "2/4", "1/3"], "answer": "1/2"},
        "g5_multi_step_word_problems": {"block_type": "mini_quiz", "block_title_th": "🎯 ลองทำดู", "question_th": f"ร้านซื้อ{theme_name} 50 ชิ้น ชิ้นละ 30 บาท ขายชิ้นละ 45 บาท แต่มี 5 ชิ้นเสียหาย ไม่ได้ขาย ร้านได้กำไรเท่าไหร่?", "choices": ["600 บาท", "650 บาท", "700 บาท", "750 บาท"], "answer": "650 บาท"},
        "g5_percent_intro": {"block_type": "mini_quiz", "block_title_th": "🎯 ลองทำดู", "question_th": f"ราคา{theme_name} 400 บาท มีส่วนลด 25% ราคาใหม่เท่าไหร่?", "choices": ["300 บาท", "320 บาท", "340 บาท", "350 บาท"], "answer": "300 บาท"},
        "g5_ratio_intro": {"block_type": "mini_quiz", "block_title_th": "🎯 ลองทำดู", "question_th": f"สูตรผสม{theme_name}ใช้อัตราส่วน 5:3 ถ้าใช้ส่วนแรก 25 ช้อน ต้องใช้ส่วนที่สองกี่ช้อน?", "choices": ["12 ช้อน", "15 ช้อน", "18 ช้อน", "20 ช้อน"], "answer": "15 ช้อน"},
        "g5_volume_area": {"block_type": "mini_quiz", "block_title_th": "🎯 ลองทำดู", "question_th": f"ตู้เก็บ{theme_name}กว้าง 8 ซม. ยาว 6 ซม. สูง 5 ซม. มีปริมาตรเท่าไหร่?", "choices": ["180 ลูกบาศก์ซม.", "200 ลูกบาศก์ซม.", "220 ลูกบาศก์ซม.", "240 ลูกบาศก์ซม."], "answer": "240 ลูกบาศก์ซม."},
    }
    blocks.append(quiz_templates.get(lesson_id, {"block_type": "mini_quiz", "block_title_th": "🎯 ลองทำดู", "question_th": "คำถามท้าทาย", "choices": ["คำตอบ 1", "คำตอบ 2", "คำตอบ 3", "คำตอบ 4"], "answer": "คำตอบ 1"}))

    return blocks


def generate_variant(lesson_id, variant_index, theme_emoji, theme_name, theme_desc):
    vid = f"v{variant_index:02d}"
    title = f"{theme_emoji} {theme_name}"
    blocks = build_visual_blocks(lesson_id, theme_emoji, theme_name)
    return {
        "variant_id": vid,
        "variant_title_th": title,
        "story_theme_th": theme_desc,
        "visual_blocks": blocks,
    }


def process_all_lessons():
    lesson_files = [
        "g5_data_graphs.json",
        "g5_decimals.json",
        "g5_fraction_operations.json",
        "g5_multi_step_word_problems.json",
        "g5_percent_intro.json",
        "g5_ratio_intro.json",
        "g5_volume_area.json",
    ]

    for fname in lesson_files:
        fpath = os.path.join(LESSONS_DIR, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        lesson_id = data["lesson_id"]
        variants = []
        for i, (emoji, name, desc) in enumerate(STORY_THEMES, start=1):
            variants.append(generate_variant(lesson_id, i, emoji, name, desc))

        data["lesson_variants"] = variants

        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"[OK] Updated {fname} with {len(variants)} variants")


if __name__ == "__main__":
    process_all_lessons()
    print("\n[DONE] All 7 lessons updated with lesson_variants!")
