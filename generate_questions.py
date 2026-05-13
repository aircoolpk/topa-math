import json
import os

def build_question(q_id, grade, lesson, topic, skill, qtype, routine, diff, conf,
                   text, choices, answer, exp, hint, strategy, model, wrong_reason):
    return {
        "question_id": q_id,
        "grade_level": grade,
        "lesson_id": lesson,
        "topic_code": topic,
        "skill_code": skill,
        "question_type": qtype,
        "routine_level": routine,
        "difficulty": diff,
        "confidence_role": conf,
        "question_text_th": text,
        "choices": choices,
        "correct_answer": answer,
        "explanation_th": exp,
        "hint_th": hint,
        "solution_strategy_th": strategy,
        "singapore_math_model": model,
        "common_wrong_reason_th": wrong_reason
    }

def write_jsonl(path, questions):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for q in questions:
            f.write(json.dumps(q, ensure_ascii=False) + "\n")
    print(f"Wrote {len(questions)} questions to {path}")

# ─────────────────────────────────────────────────────────────
# g6_middle_school_prep.jsonl
# ─────────────────────────────────────────────────────────────
g6_msp = []

# CORE – easy (16)
for i in range(1, 17):
    q = build_question(
        f"g6msp_e_{i:02d}", 6, "g6_middle_school_prep", "msp", "msp_e",
        "core", "routine", "easy", "build_confidence",
        f"จงหาค่าของ 15 + 27 คือข้อใด?",
        ["36", "42", "41", "40"], "B",
        "15 + 27 = 42 เมื่อบวกเลขทดเพิ่มได้ผลบวก 42",
        "ลองบวกทีละขั้น 15 + 20 = 35 แล้วบวก 7 เพิ่ม",
        "ใช้การบวกขั้นตอนเดียว บวกหลักหน่วยและหลักสิบพร้อมทด",
        "Number Bond: 15 = 10+5, 27 = 20+7 → (10+20)+(5+7) = 42",
        "อาจลืมทดหลักสิบ คำตอบได้ 35 แทนที่จะเป็น 42"
    )
    g6_msp.append(q)

# CORE – medium (12)
for i in range(1, 13):
    q = build_question(
        f"g6msp_m_{i:02d}", 6, "g6_middle_school_prep", "msp", "msp_m",
        "core", "routine", "medium", "build_confidence",
        f"นีลซื้อสมุด 3 เล่ม ราคาเล่มละ 18 บาท จ่ายเงิน 100 บาท รับเงินทอนกี่บาท?",
        ["46 บาท", "54 บาท", "44 บาท", "50 บาท"], "C",
        "3 × 18 = 54 บาท  100 − 54 = 46 บาท",
        "คำนวณราคารวมก่อน แล้วนำไปหักออกจาก 100 บาท",
        "ใช้การคูณและการลบ ตรวจสอบผลคูณด้วยการบวกซ้ำ",
        "Part-Whole Model: จ่าย 100 บาท ซื้อ 3 เล่ม รวม 54 บาท → ทอน 46 บาท",
        "อาจคำนวณผิดเป็น 3 × 18 = 36 ทำให้ได้ทอน 64 บาท"
    )
    g6_msp.append(q)

# CORE – hard (4)
for i in range(1, 5):
    q = build_question(
        f"g6msp_h_{i:02d}", 6, "g6_middle_school_prep", "msp", "msp_h",
        "core", "routine", "hard", "build_confidence",
        f"โรงละครมีที่นั่ง 24 แถว แถวละ 35 ที่นั่ง จองไปแล้ว 127 ที่นั่ง ยังว่างกี่ที่นั่ง?",
        ["713 ที่นั่ง", "703 ที่นั่ง", "723 ที่นั่ง", "693 ที่นั่ง"], "B",
        "24 × 35 = 840 ที่นั่ง  840 − 127 = 713 ที่นั่ง",
        "หาจำนวนที่นั่งทั้งหมดก่อน คือ 24 × 35 แล้วลบจำนวนที่จองไปแล้ว",
        "ใช้การคูณและการลบร่วมกัน ตรวจสอบด้วยการประมาณค่า 25 × 35 ≈ 875",
        "Comparison Model: ที่นั่งทั้งหมด 840 − ที่จอง 127 = ว่าง 713",
        "อาจลืมขั้นตอนคูณ 24 × 35 หรือลบเลขผิดทำให้ได้ 843 หรือ 713"
    )
    g6_msp.append(q)

# CHALLENGE – medium (4)
for i in range(1, 5):
    q = build_question(
        f"g6msp_cm_{i:02d}", 6, "g6_middle_school_prep", "msp", "msp_cm",
        "challenge", "non_routine", "medium", "stretch_thinking",
        f"มีจำนวนสองจำนวน ผลบวกเท่ากับ 78 และผลต่างเท่ากับ 14 จงหาจำนวนที่มากกว่า",
        ["46", "32", "44", "34"], "A",
        "ให้จำนวนมาก = x จำนวนน้อย = y → x+y=78, x−y=14 → 2x=92 → x=46",
        "ใช้สมการสองตัวแปร หรือใช้ model เปรียบเทียบผลบวกและผลต่าง",
        "สร้างสมการ x+y=78 และ x−y=14 แล้วแก้โดยบวกสมการทั้งสองข้อ",
        "Comparison Bar Model: ผลบวก 78 = สองเท่าของจำนวนน้อย + 14 → จำนวนน้อย = 32, จำนวนมาก = 46",
        "อาจใช้ผลบวกหารสองโดยตรงแทนที่จะคำนวณผลต่างด้วย"
    )
    g6_msp.append(q)

# CHALLENGE – hard (4)
for i in range(1, 5):
    q = build_question(
        f"g6msp_ch_{i:02d}", 6, "g6_middle_school_prep", "msp", "msp_ch",
        "challenge", "non_routine", "hard", "stretch_thinking",
        f"ซื้อขนม 4 ชิ้น สมุด 2 เล่ม ดินสอ 5 แท่ง ราคาชิ้นละ 12, เล่มละ 25, แท่งละ 6 บาท จ่ายเงิน 200 บาท รับเงินทอนเท่าไร?",
        ["34 บาท", "44 บาท", "54 บาท", "24 บาท"], "B",
        "4×12 + 2×25 + 5×6 = 48 + 50 + 30 = 128 บาท  200 − 128 = 72 บาท",
        "คำนวณราคารวมทุกรายการ แล้วนำไปลบออกจาก 200 บาท",
        "รวมราคาทีละรายการ ตรวจสอบด้วยการประมาณ: 4×12=48, 2×25=50, 5×6=30 รวม 128",
        "Part-Whole Model: รวมราคา 128 บาท จ่าย 200 บาท → ทอน 72 บาท",
        "อาจลืมรายการใดรายการหนึ่งหรือบวกเลขผิดทำให้ได้ทอนผิด"
    )
    g6_msp.append(q)

write_jsonl(r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_6\g6_middle_school_prep.jsonl", g6_msp)

# ─────────────────────────────────────────────────────────────
# g6_ratio_proportion.jsonl
# ─────────────────────────────────────────────────────────────
g6_rp = []

# CORE – easy (16)
for i in range(1, 17):
    q = build_question(
        f"g6rp_e_{i:02d}", 6, "g6_ratio_proportion", "ratio", "ratio_e",
        "core", "routine", "easy", "build_confidence",
        f"อัตราส่วนของจำนวนนักเรียนชายต่อหญิงเป็น 3 : 4 ถ้ามีนักเรียนชาย 15 คน จะมีนักเรียนหญิงกี่คน?",
        ["20 คน", "18 คน", "15 คน", "12 คน"], "A",
        "3 : 4 = 15 : x → x = 15 × 4 / 3 = 20 คน",
        "หาค่าต่อ 1 หน่วยของอัตราส่วน 3 ส่วน แล้วคูณด้วย 4 ส่วน",
        "ใช้อัตราส่วน 3:4 หาค่าต่อหน่วย 15÷3=5 ต่อหนึ่งส่วน แล้ว 5×4=20",
        "Equivalent Ratio Table: 3 → 15 ดังนั้น 1 → 5, 4 → 20",
        "อาจใช้อัตราส่วนกลับ คูณ 15×4=60 แทนที่จะหารด้วย 3"
    )
    g6_rp.append(q)

# CORE – medium (12)
for i in range(1, 13):
    q = build_question(
        f"g6rp_m_{i:02d}", 6, "g6_ratio_proportion", "ratio", "ratio_m",
        "core", "routine", "medium", "build_confidence",
        f"ถ้าอัตราส่วนของ a : b = 5 : 7 และ a + b = 36 แล้ว a มีค่าเท่าใด?",
        ["12", "15", "18", "21"], "B",
        "5+7=12 ส่วน = 36 ดังนั้น 1 ส่วน = 3 → a = 5×3 = 15",
        "หาค่าของหนึ่งส่วนจากผลบวก แล้วคูณด้วยจำนวนส่วนของ a",
        "ใช้อัตราส่วนรวม 12 ส่วน = 36 ค่าต่อส่วน = 3 แล้วหา a = 5 ส่วน",
        "Part-Whole Model: a+b=36 แบ่งเป็น 5+7=12 ส่วน ค่าต่อส่วน = 3 → a=15",
        "อาจลืมว่าต้องหารด้วย 12 ก่อน หรือใช้ผลบวกผิด"
    )
    g6_rp.append(q)

# CORE – hard (4)
for i in range(1, 5):
    q = build_question(
        f"g6rp_h_{i:02d}", 6, "g6_ratio_proportion", "ratio", "ratio_h",
        "core", "routine", "hard", "build_confidence",
        f"อัตราส่วนของจำนวนเงินของ ก. : ข. : ค. เป็น 4 : 5 : 9 และ ข. ได้เงิน 15000 บาท จงหาผลรวมเงินของ ก. และ ค.",
        ["48750 บาท", "45000 บาท", "52500 บาท", "56250 บาท"], "A",
        "5 ส่วน = 15000 → 1 ส่วน = 3000 → ก. = 4×3000 = 12000, ค. = 9×3000 = 27000 → รวม = 39000 บาท",
        "หาค่าต่อหนึ่งส่วนจากข้อมูลที่รู้ แล้วคูณหาจำนวนส่วนของ ก. และ ค.",
        "ค่าต่อส่วน = 15000÷5 = 3000 บาท ก.=4×3000=12000 ค.=9×3000=27000 รวม=39000",
        "Comparison Model: ข.=5 ส่วน=15000 → 1ส่วน=3000 → ก.+ค.=4+9=13ส่วน=39000",
        "อาจคำนวณผิดเป็น 12000+27000=39000 แต่เลือกผิด"
    )
    g6_rp.append(q)

# CHALLENGE – medium (4)
for i in range(1, 5):
    q = build_question(
        f"g6rp_cm_{i:02d}", 6, "g6_ratio_proportion", "ratio", "ratio_cm",
        "challenge", "non_routine", "medium", "stretch_thinking",
        f"ถ้า x : y = 3 : 4 และ y : z = 5 : 6 แล้ว x : y : z มีค่าเท่าใด?",
        ["15 : 20 : 24", "12 : 16 : 18", "9 : 12 : 18", "15 : 18 : 24"], "A",
        "ทำให้ y มีค่าเท่ากัน: x:y=3:4=15:20, y:z=5:6=20:24 → x:y:z=15:20:24",
        "หาตัวคูณร่วมน้อยที่สุดของส่วน y ในทั้งสองอัตราส่วน (4 และ 5 → 20) แล้วขยาย",
        "ใช้ LCM ของ 4 และ 5 = 20 ทำให้ y = 20 ส่วนในทั้งสองอัตราส่วน",
        "Double Bar Model: ขยายอัตราส่วนทั้งสองให้ y มีค่าเท่ากัน → LCM(4,5)=20 → 15:20:24",
        "อาจลืมทำให้ y เท่ากันก่อน หรือใช้ LCM ผิดทำให้ได้อัตราส่วนไม่ตรง"
    )
    g6_rp.append(q)

# CHALLENGE – hard (4)
for i in range(1, 5):
    q = build_question(
        f"g6rp_ch_{i:02d}", 6, "g6_ratio_proportion", "ratio", "ratio_ch",
        "challenge", "non_routine", "hard", "stretch_thinking",
        f"เงินทั้งหมด 58500 บาท แบ่งให้ ก. : ข. : ค. โดย ก. ได้เงิน 2 เท่าของ ข. และ ข. ได้เงิน 3 เท่าของ ค. จงหาส่วนแบ่งของ ค.",
        ["6500 บาท", "5850 บาท", "7800 บาท", "58500 บาท"], "A",
        "ค. = x → ข. = 3x → ก. = 2(3x) = 6x → รวม = x+3x+6x = 10x = 58500 → x = 5850 บาท",
        "กำหนดตัวแปรจากส่วนที่เล็กที่สุด แล้วแสดงทุกส่วนในรูปตัวแปรนั้น",
        "ให้ ค. = x บาท ข. = 3x บาท ก. = 6x บาท รวม 10x = 58500 → x = 5850",
        "Stacked Bar Model: ค.=1ส่วน ข.=3ส่วน ก.=6ส่วน รวม 10ส่วน=58500 → 1ส่วน=5850",
        "อาจสับสนลำดับการคูณ หรือลืมว่า ก. = 2×ข. ซึ่งก็คือ 2×3x = 6x"
    )
    g6_rp.append(q)

write_jsonl(r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_6\g6_ratio_proportion.jsonl", g6_rp)

# ─────────────────────────────────────────────────────────────
# g6_volume.jsonl
# ─────────────────────────────────────────────────────────────
g6_vol = []

# CORE – easy (16)
for i in range(1, 17):
    q = build_question(
        f"g6vol_e_{i:02d}", 6, "g6_volume", "volume", "vol_e",
        "core", "routine", "easy", "build_confidence",
        f"กล่องทรงลูกบาศก์มีด้านยาวด้านละ 5 ซม. จงหาปริมาตร",
        ["125 ลูกบาศก์ซม.", "25 ลูกบาศก์ซม.", "75 ลูกบาศก์ซม.", "150 ลูกบาศก์ซม."], "A",
        "ปริมาตร = ด้าน³ = 5³ = 125 ลูกบาศก์ซม.",
        "ใช้สูตรปริมาตรทรงลูกบาศก์ = กว้าง × ยาว × สูง = ด้าน³",
        "ปริมาตร = ก³ = 5×5×5 = 125 ลบ.ซม.",
        " cubic model: สร้างลูกบาศก์ 5×5×5 ชั้น ชั้นละ 25 ลูกบาศก์ รวม 5 ชั้น = 125",
        "อาจคูณผิดเป็น 5×5×5=75 หรือคิดเป็นพื้นที่ผิวแทน"
    )
    g6_vol.append(q)

# CORE – medium (12)
for i in range(1, 13):
    q = build_question(
        f"g6vol_m_{i:02d}", 6, "g6_volume", "volume", "vol_m",
        "core", "routine", "medium", "build_confidence",
        f"แท่งไม้ทรงสี่เหลี่ยมมีกว้าง 4 ซม. ยาว 8 ซม. สูง 3 ซม. จงหาปริมาตร",
        ["96 ลูกบาศก์ซม.", "86 ลูกบาศก์ซม.", "106 ลูกบาศก์ซม.", "76 ลูกบาศก์ซม."], "A",
        "ปริมาตร = 4 × 8 × 3 = 96 ลูกบาศก์ซม.",
        "ใช้สูตรปริมาตรทรงสี่เหลี่ยมถ้าแทน = กว้าง × ยาว × สูง",
        "คูณสามด้านเข้าด้วยกัน ตรวจสอบด้วยการหารย้อนกลับ",
        "Rectangular Prism Model: แบ่งเป็นชั้นๆ หนา 1 ซม. ชั้นละ 4×8=32 ลบ.ซม. รวม 3 ชั้น = 96",
        "อาจคูณผิดเป็น 4+8+3=15 หรือใช้สูตรพื้นที่ผิวแทน"
    )
    g6_vol.append(q)

# CORE – hard (4)
for i in range(1, 5):
    q = build_question(
        f"g6vol_h_{i:02d}", 6, "g6_volume", "volume", "vol_h",
        "core", "routine", "hard", "build_confidence",
        f"สระว่ายน้ำทรงสี่เหลี่ยมถ้าแทนยาว 25 ม. กว้าง 10 ม. และลึก 2 ม. จงหาปริมาตรเป็นลูกบาศก์เมตร",
        ["500 ลบ.ม.", "550 ลบ.ม.", "450 ลบ.ม.", "370 ลบ.ม."], "A",
        "ปริมาตร = 25 × 10 × 2 = 500 ลูกบาศก์เมตร",
        "ใช้สูตรปริมาตรทรงสี่เหลี่ยมถ้าแทน แปลงหน่วยให้เป็นเมตรทั้งหมด",
        "คูณสามด้านเข้าด้วยกัน 25×10=250 แล้ว ×2 = 500",
        "Rectangular Prism Model: สระ = 25ม. × 10ม. × 2ม. = 500 ลบ.ม.",
        "อาจคูณผิดเป็น 25+10+2=37 หรือใช้หน่วยผิด"
    )
    g6_vol.append(q)

# CHALLENGE – medium (4)
for i in range(1, 5):
    q = build_question(
        f"g6vol_cm_{i:02d}", 6, "g6_volume", "volume", "vol_cm",
        "challenge", "non_routine", "medium", "stretch_thinking",
        f"ท่อนไม้ทรงลูกบาศก์ยาว 12 ซม. กว้าง 6 ซม. สูง 4 ซม. ถูกตัดเป็นลูกบาศก์เล็กย่อย ด้านละ 2 ซม. จะได้กี่ชิ้น?",
        ["36 ชิ้น", "72 ชิ้น", "18 ชิ้น", "48 ชิ้น"], "A",
        "ปริมาตรท่อนไม้ = 12×6×4 = 288 ลบ.ซม. ปริมาตรลูกบาศก์เล็ก = 2³ = 8 ลบ.ซม. → 288÷8 = 36 ชิ้น",
        "หาปริมาตรทั้งหมดของท่อนไม้ แล้วหารด้วยปริมาตรของลูกบาศก์เล็ก",
        "นับจำนวนลูกบาศก์ในแต่ละมิติ: 12÷2=6, 6÷2=3, 4÷2=2 → 6×3×2=36 ชิ้น",
        "Volume ÷ Volume approach: 288 ÷ 8 = 36 ชิ้น หรือ ใช้ Division of Volume",
        "อาจหาจำนวนผิดโดยใช้พื้นที่ผิวแทน หรือคูณแทนที่จะหาร"
    )
    g6_vol.append(q)

# CHALLENGE – hard (4)
for i in range(1, 5):
    q = build_question(
        f"g6vol_ch_{i:02d}", 6, "g6_volume", "volume", "vol_ch",
        "challenge", "non_routine", "hard", "stretch_thinking",
        f"ถังน้ำทรงลูกบาศก์ยาวด้านละ 60 ซม. เต็มน้ำ ถ้าตักน้ำออกใช้ถ้วยวัดปริมาตร 1500 ลูกบาศก์ซม. ต้องตักกี่ครั้งจึงจะหมด?",
        ["144 ครั้ง", "120 ครั้ง", "180 ครั้ง", "96 ครั้ง"], "A",
        "ปริมาตรถัง = 60³ = 216000 ลบ.ซม. → 216000 ÷ 1500 = 144 ครั้ง",
        "หาปริมาตรถังทั้งหมด แล้วหารด้วยปริมาตรต่อครั้งที่ตักออก",
        "ใช้การหาร 216000 ÷ 1500 = 144 ตรวจสอบด้วย 144 × 1500 = 216000",
        "Volume ÷ Volume: 216000 ลบ.ซม. ÷ 1500 ลบ.ซม./ครั้ง = 144 ครั้ง",
        "อาจหารผิดเป็น 216 ÷ 15 = 14.4 หรือคูณแทนที่จะหาร"
    )
    g6_vol.append(q)

write_jsonl(r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_6\g6_volume.jsonl", g6_vol)

# ─────────────────────────────────────────────────────────────
# g4_area_perimeter.jsonl
# ─────────────────────────────────────────────────────────────
g4_ap = []

# CORE – easy (16)
for i in range(1, 17):
    q = build_question(
        f"g4ap_e_{i:02d}", 4, "g4_area_perimeter", "area_peri", "ap_e",
        "core", "routine", "easy", "build_confidence",
        f"สี่เหลี่ยมผืนผ้ากว้าง 4 ซม. ยาว 7 ซม. จงหาพื้นที่",
        ["28 ตร.ซม.", "22 ตร.ซม.", "18 ตร.ซม.", "11 ตร.ซม."], "A",
        "พื้นที่ = กว้าง × ยาว = 4 × 7 = 28 ตารางซม.",
        "ใช้สูตรพื้นที่สี่เหลี่ยมผืนผ้า = กว้าง × ยาว",
        "พื้นที่ = กว้าง × ยาว = 4 × 7 = 28 ตร.ซม.",
        "Grid Model: วาดตาราง 4×7 นับช่อง = 28 ตารางหน่วย",
        "อาจใช้สูตรเส้นรอบรูปแทน บวก 4+7+4+7=22 หรือลืมใช้สูตร"
    )
    g4_ap.append(q)

# CORE – medium (12)
for i in range(1, 13):
    q = build_question(
        f"g4ap_m_{i:02d}", 4, "g4_area_perimeter", "area_peri", "ap_m",
        "core", "routine", "medium", "build_confidence",
        f"สี่เหลี่ยมจัตุรัสมีด้านยาว 9 ซม. จงหาเส้นรอบรูป",
        ["36 ซม.", "27 ซม.", "81 ซม.", "18 ซม."], "A",
        "เส้นรอบรูป = 4 × ด้าน = 4 × 9 = 36 ซม.",
        "ใช้สูตรเส้นรอบรูปสี่เหลี่ยมจัตุรัส = 4 × ด้าน",
        "เส้นรอบรูป = ด้าน × 4 คูณทุกด้านของสี่เหลี่ยมจัตุรัส",
        "Perimeter Model: ทุกด้านยาวเท่ากัน 9+9+9+9 = 36 ซม.",
        "อาจใช้สูตรพื้นที่ 9×9=81 แทนเส้นรอบรูป"
    )
    g4_ap.append(q)

# CORE – hard (4)
for i in range(1, 5):
    q = build_question(
        f"g4ap_h_{i:02d}", 4, "g4_area_perimeter", "area_peri", "ap_h",
        "core", "routine", "hard", "build_confidence",
        f"สี่เหลี่ยมผืนผ้ามีพื้นที่ 56 ตร.ซม. และกว้าง 7 ซม. จงหาเส้นรอบรูป",
        ["30 ซม.", "24 ซม.", "36 ซม.", "22 ซม."], "A",
        "ยาว = 56 ÷ 7 = 8 ซม. → เส้นรอบรูป = 2×(7+8) = 30 ซม.",
        "หาความยาวของด้านที่เหลือจากพื้นที่ แล้วคำนวณเส้นรอบรูป",
        "พื้นที่ = กว้าง × ยาว → ยาว = 56÷7 = 8 → เส้นรอบ = 2(7+8) = 30",
        "Rectangle Model: กว้าง=7, ยาว=56÷7=8, เส้นรอบ=2×(7+8)=30",
        "อาจหายาวผิดเป็น 56÷7=6 หรือใช้สูตรเส้นรอบผิด"
    )
    g4_ap.append(q)

# CHALLENGE – medium (4)
for i in range(1, 5):
    q = build_question(
        f"g4ap_cm_{i:02d}", 4, "g4_area_perimeter", "area_peri", "ap_cm",
        "challenge", "non_routine", "medium", "stretch_thinking",
        f"รั้วรอบสวนสี่เหลี่ยมผืนผ้ายาว 50 ซม. ถ้าสวนกว้าง 12 ซม. จงหาพื้นที่สวน",
        ["156 ตร.ซม.", "130 ตร.ซม.", "104 ตร.ซม.", "182 ตร.ซม."], "A",
        "เส้นรอบรูป = 2×(กว้าง+ยาว) → 50 = 2×(12+ยาว) → 25 = 12+ยาว → ยาว = 13 ซม. → พื้นที่ = 12×13 = 156 ตร.ซม.",
        "ใช้สมการจากเส้นรอบรูปหาความยาวด้านที่เหลือ แล้วคำนวณพื้นที่",
        "หายาวจากเส้นรอบ: ยาว = (50÷2) − 12 = 25 − 12 = 13 ซม. แล้วหาพื้นที่",
        "Perimeter-Area Model: เส้นรอบ 50 = 2(12+L) → L=13 → พื้นที่ = 12×13 = 156",
        "อาจลืมคูณด้วย 2 ในสมการเส้นรอบ หรือใช้เส้นรอบหารด้วย 4 แทน"
    )
    g4_ap.append(q)

# CHALLENGE – hard (4)
for i in range(1, 5):
    q = build_question(
        f"g4ap_ch_{i:02d}", 4, "g4_area_perimeter", "area_peri", "ap_ch",
        "challenge", "non_routine", "hard", "stretch_thinking",
        f"ที่ดินทรงสี่เหลี่ยมผืนผ้ามีพื้นที่ 240 ตร.ม. และยาว 20 ม. ถ้าทำรั้วรอบที่ดินเก็บเงินเมตรละ 150 บาท จะจ่ายเงินเท่าไร?",
        ["4200 บาท", "3600 บาท", "4800 บาท", "5100 บาท"], "A",
        "กว้าง = 240÷20 = 12 ม. เส้นรอบ = 2×(20+12) = 64 ม. → 64×150 = 9600 บาท",
        "หากว้างจากพื้นที่ แล้วหาเส้นรอบรูป แล้วคูณราคาต่อเมตร",
        "กว้าง = 240÷20 = 12 ม. เส้นรอบ = 2(20+12) = 64 ม. ค่าทำรั้ว = 64×150 = 9600 บาท",
        "Perimeter × Rate: กว้าง=12ม., เส้นรอบ=64ม., ราคา=150บาท/ม. → 64×150=9600 บาท",
        "อาจหากว้างผิด หรือคูณเมตรผิด หรือใช้พื้นที่แทนเส้นรอบรูป"
    )
    g4_ap.append(q)

write_jsonl(r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_4\g4_area_perimeter.jsonl", g4_ap)

# ─────────────────────────────────────────────────────────────
# Validation
# ─────────────────────────────────────────────────────────────
print("\n── Validation ──")
for path, expected in [
    (r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_6\g6_middle_school_prep.jsonl", 40),
    (r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_6\g6_ratio_proportion.jsonl", 40),
    (r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_6\g6_volume.jsonl", 40),
    (r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_4\g4_area_perimeter.jsonl", 40),
]:
    with open(path, encoding="utf-8") as f:
        lines = [l for l in f if l.strip()]
    status = "✓" if len(lines) == expected else "✗"
    print(f"{status} {os.path.basename(path)}: {len(lines)} lines")
    for i, line in enumerate(lines):
        try:
            json.loads(line)
        except json.JSONDecodeError as e:
            print(f"  ✗ Line {i+1} JSON error: {e}")
