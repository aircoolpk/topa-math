#!/usr/bin/env python3
"""Generate all 42 question bank topic files (7 per grade, 40 questions each)"""
import json, random, pathlib

BASE = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')

# All topics per grade (7 per grade)
LESSONS = {
    1: ["g1_counting_20","g1_add_one_digit","g1_subtract_one_digit","g1_compare_numbers","g1_number_order","g1_shapes_2d_basic","g1_position_direction"],
    2: ["g2_add_two_digit","g2_subtract_two_digit","g2_multiplication_intro","g2_times_table_2_5_10","g2_money_change","g2_time_calendar","g2_shapes_2d"],
    3: ["g3_multiplication_multi_digit","g3_division_intro","g3_fractions_intro","g3_multi_step_word_problems","g3_measurement","g3_area_intro","g3_mixed_review"],
    4: ["g4_large_numbers","g4_decimals_intro","g4_fractions","g4_multi_digit_operations","g4_word_problems","g4_angles_geometry","g4_area_perimeter"],
    5: ["g5_data_graphs","g5_decimals","g5_fraction_operations","g5_multi_step_word_problems","g5_volume_area","g5_percentage","g5_ratio"],
    6: ["g6_equations_intro","g6_middle_school_prep","g6_ratio_proportion","g6_volume","g6_coordinate_plane","g6_percentage_applications","g6_circle_geometry"],
}

def qid(lid, n):
    return f"{lid}_q{n:03d}"

def gen_q(grade, lid, num, qtype, diff):
    conf = "build_confidence" if qtype == "core" else "stretch_thinking"
    rl = "routine" if qtype == "core" else "non_routine"

    if lid == "g1_counting_20":
        n = random.randint(1, 20)
        q_text = f"เลข {n} เขียนเป็นตัวเลขอารบิกว่าอะไร?"
        ans_str = str(n)
    elif lid == "g1_add_one_digit":
        a, b = random.randint(1,9), random.randint(1,9)
        q_text = f"{a} + {b} = ?"
        ans_str = str(a+b)
    elif lid == "g1_subtract_one_digit":
        a = random.randint(5,18)
        b = random.randint(1, a-1)
        q_text = f"{a} - {b} = ?"
        ans_str = str(a-b)
    elif lid == "g1_compare_numbers":
        a, b = random.randint(1,19), random.randint(1,19)
        q_text = f"เลข {a} กับ {b} เลขไหนมากกว่า?"
        ans_str = str(max(a,b))
    elif lid == "g1_number_order":
        nums = sorted(random.sample(range(1,21), 4))
        q_text = f"เรียงจากน้อยไปมาก: {nums[3]}, {nums[0]}, {nums[2]}, {nums[1]}"
        ans_str = f"{nums[0]}, {nums[1]}, {nums[2]}, {nums[3]}"
    elif lid == "g1_shapes_2d_basic":
        shapes = [("วงกลม",0),("สามเหลี่ยม",3),("สี่เหลี่ยม",4),("ห้าเหลี่ยม",5)]
        name, corners = random.choice(shapes)
        q_text = f"{name} มีกี่มุม?"
        ans_str = str(corners)
    elif lid == "g1_position_direction":
        dirs = ["ซ้าย","ขวา","บน","ล่าง"]
        q_text = f"ถ้าเดินไปทาง{random.choice(dirs)} แล้วเลี้ยวขวา ตอนนี้หันไปทางไหน?"
        ans_str = random.choice(["เดิมทาง","ซ้าย","ขวา","กลับทาง"])
    elif lid == "g2_add_two_digit":
        a, b = random.randint(10,99), random.randint(10,99)
        q_text = f"{a} + {b} = ?"
        ans_str = str(a+b)
    elif lid == "g2_subtract_two_digit":
        a = random.randint(50,99)
        b = random.randint(10, a-1)
        q_text = f"{a} - {b} = ?"
        ans_str = str(a-b)
    elif lid == "g2_multiplication_intro":
        a, b = random.randint(2,5), random.randint(1,5)
        q_text = f"{a} × {b} = ?"
        ans_str = str(a*b)
    elif lid == "g2_times_table_2_5_10":
        table = random.choice([2,5,10])
        n = random.randint(1,10)
        q_text = f"{table} × {n} = ?"
        ans_str = str(table*n)
    elif lid == "g2_money_change":
        price = random.randint(5,95)
        paid = price + random.randint(5,95)
        q_text = f"ของราคา {price} บาท จ่ายเงิน {paid} บาท ได้เงินทอนกี่บาท?"
        ans_str = str(paid - price)
    elif lid == "g2_time_calendar":
        h1 = random.randint(1,11)
        h2 = min(h1 + random.randint(1,5), 12)
        q_text = f"เด็กเริ่มเข้าเรียนเวลา {h1} โมง จบเวลา {h2} โมง รวมเวลาเรียนกี่ชั่วโมง?"
        ans_str = str(h2 - h1)
    elif lid == "g2_shapes_2d":
        shapes = [("วงกลม",0,0),("สามเหลี่ยม",3,3),("สี่เหลี่ยม",4,4),("ห้าเหลี่ยม",5,5),("หกเหลี่ยม",6,6)]
        name, corners, sides = random.choice(shapes)
        q_text = f"{name} มีกี่มุม?"
        ans_str = str(corners)
    elif lid == "g3_multiplication_multi_digit":
        a, b = random.randint(10,99), random.randint(2,5)
        q_text = f"{a} × {b} = ?"
        ans_str = str(a*b)
    elif lid == "g3_division_intro":
        b = random.randint(2,9)
        ans_val = random.randint(2,9)
        a = ans_val * b
        q_text = f"{a} ÷ {b} = ?"
        ans_str = str(ans_val)
    elif lid == "g3_fractions_intro":
        d = random.choice([2,3,4,5])
        n = random.randint(1, d-1)
        q_text = f"เศษส่วนที่มีค่าเท่ากับ {n}/{d} คือข้อใด?"
        ans_str = f"{n}/{d}"
    elif lid == "g3_multi_step_word_problems":
        items = [
            ("ซื้อปากกา 3 ด้าม ด้ามละ 15 บาท และยางลบ 2 ด้าม ด้ามละ 10 บาท รวมเท่าไร?", "65"),
            ("แม่มีผลไม้ 25 ผล แบ่งให้ลูก 5 คน คนละกี่ผล?", "5"),
        ]
        q_text, ans_str = random.choice(items)
    elif lid == "g3_measurement":
        l = random.randint(10,99)
        w = random.randint(5, l-1)
        q_text = f"สี่เหลี่ยมกว้าง {w} ยาว {l} หน่วย เส้นรอบรูปยาวกี่หน่วย?"
        ans_str = str(2*(l+w))
    elif lid == "g3_area_intro":
        l, w = random.randint(2,8), random.randint(2,8)
        q_text = f"สี่เหลี่ยมกว้าง {w} ยาว {l} หน่วย มีพื้นที่เท่าไร?"
        ans_str = str(l*w)
    elif lid == "g3_mixed_review":
        a, b = random.randint(10,50), random.randint(2,9)
        q_text = f"{a} ÷ {b} = ?"
        ans_str = str(a // b)
    elif lid == "g4_large_numbers":
        nums = sorted([random.randint(100,9999) for _ in range(4)], reverse=True)
        q_text = f"จำนวนในข้อใดมากที่สุด: {nums[3]}, {nums[1]}, {nums[0]}, {nums[2]}"
        ans_str = str(nums[0])
    elif lid == "g4_decimals_intro":
        a = round(random.uniform(0.1, 9.9), 1)
        b = round(random.uniform(0.1, 9.9), 1)
        q_text = f"จำนวนในข้อใดมากกว่า: {a} หรือ {b}?"
        ans_str = f"{max(a,b)}"
    elif lid == "g4_fractions":
        d = random.choice([2,3,4,5,6])
        n = random.randint(1, d-1)
        q_text = f"เศษส่วนใดเท่ากับ {n}/{d}?"
        ans_str = f"{n}/{d}"
    elif lid == "g4_multi_digit_operations":
        op = random.choice([0,1])
        if op == 0:
            a, b = random.randint(100,999), random.randint(10,99)
            q_text = f"{a} × {b} = ?"
            ans_str = str(a*b)
        else:
            ans_val = random.randint(10,99)
            b = random.randint(2,9)
            a = ans_val * b
            q_text = f"{a} ÷ {b} = ?"
            ans_str = str(ans_val)
    elif lid == "g4_word_problems":
        items = [("ซื้อปากกา 5 ด้าม ด้ามละ 15 บาท รวมเท่าไร?", "75"),
                  ("แม่มีลูกชิ้น 48 ลูก แบ่งให้ลูก 4 คน คนละกี่ลูก?", "12")]
        q_text, ans_str = random.choice(items)
    elif lid == "g4_angles_geometry":
        q_text = f"มุมที่มีขนาด 90 องศา เรียกว่ามุมอะไร?"
        ans_str = random.choice(["มุมฉาก","มุมแหลม","มุมป้าน","มุมตรง"])
    elif lid == "g4_area_perimeter":
        l = random.randint(5,15)
        w = random.randint(3, l-1)
        q_text = f"สี่เหลี่ยมกว้าง {w} ยาว {l} หน่วย พื้นที่เท่าไร?"
        ans_str = str(l*w)
    elif lid == "g5_data_graphs":
        vals = [random.randint(20,80) for _ in range(4)]
        names = ["A","B","C","D"]
        biggest = names[vals.index(max(vals))]
        q_text = f"สินค้า A={vals[0]} B={vals[1]} C={vals[2]} D={vals[3]} สินค้าใดมากที่สุด?"
        ans_str = f"สินค้า {biggest}"
    elif lid == "g5_decimals":
        a = round(random.uniform(1, 9.9), 1)
        b = round(random.uniform(1, 9.9), 1)
        q_text = f"{a} + {b} = ?"
        ans_str = f"{round(a+b, 1)}"
    elif lid == "g5_fraction_operations":
        a, b = random.randint(1,5), random.randint(2,5)
        q_text = f"{a} ÷ {b} = ?"
        ans_str = f"{round(a/b, 2)}"
    elif lid == "g5_multi_step_word_problems":
        items = [("ซื้อสมุด 25 บาท 2 เล่ม และดินสอ 10 บาท 3 แท่ง รวมเท่าไร?", "80"),
                  ("มีเงิน 100 บาท ซื้อของ 35 บาท และ 45 บาท เหลือเท่าไร?", "20")]
        q_text, ans_str = random.choice(items)
    elif lid == "g5_volume_area":
        l, w, h = random.randint(2,5), random.randint(2,5), random.randint(2,5)
        q_text = f"กล่องกว้าง {l} ยาว {w} สูง {h} หน่วย ปริมาตรเท่าไร?"
        ans_str = str(l*w*h)
    elif lid == "g5_percentage":
        p = random.randint(10,50)
        whole = 100
        q_text = f"{p}% ของ 100 มีค่าเท่าไร?"
        ans_str = str(p)
    elif lid == "g5_ratio":
        a, b = random.randint(2,5), random.randint(2,5)
        actual_a = a * random.randint(3,6)
        actual_b = b * (actual_a // a)
        q_text = f"อัตราส่วน {a}:{b} ถ้ามี {a} หน่วยได้ {b} หน่วย ถ้ามี {actual_a} หน่วยจะได้เท่าไร?"
        ans_str = str(actual_b)
    elif lid == "g6_equations_intro":
        t = random.choice(["x", "y"])
        a = random.randint(2,9)
        b = random.randint(1,20)
        q_text = f"{t} + {a} = {b} แล้ว {t} = ?"
        ans_str = str(b - a)
    elif lid == "g6_middle_school_prep":
        ops = [("3 + 5 × 2 = ?", "13"), ("(3 + 5) × 2 = ?", "16"), ("12 ÷ 3 - 2 = ?", "2")]
        q_text, ans_str = random.choice(ops)
    elif lid == "g6_ratio_proportion":
        a, b = random.randint(2,5), random.randint(2,5)
        actual_a = a * random.randint(3,6)
        actual_b = b * (actual_a // a)
        q_text = f"อัตราส่วน {a}:{b} ถ้ามี {a} หน่วยได้ {b} หน่วย ถ้ามี {actual_a} หน่วยจะได้เท่าไร?"
        ans_str = str(actual_b)
    elif lid == "g6_volume":
        r = random.randint(2,5)
        q_text = f"ทรงกลมมีรัศมี {r} หน่วย ปริมาตรเท่าไร (π ≈ 3.14)?"
        ans_str = f"{round(4/3*3.14*r**3, 1)}"
    elif lid == "g6_coordinate_plane":
        q_text = "จุด (3, 4) อยู่ในควอแดรนต์ไหน?"
        ans_str = random.choice(["ควอแดรนต์ 1","ควอแดรนต์ 2","ควอแดรนต์ 3","ควอแดรนต์ 4"])
    elif lid == "g6_percentage_applications":
        p = random.randint(10,30)
        whole = 200
        q_text = f"{p}% ของ 200 มีค่าเท่าไร?"
        ans_str = str(p*2)
    elif lid == "g6_circle_geometry":
        r = random.randint(2,10)
        q_text = f"วงกลมมีรัศมี {r} หน่วย เส้นรอบวงยาวเท่าไร (π ≈ 3.14)?"
        ans_str = f"{round(2*3.14*r, 1)}"
    else:
        q_text = f"คำถามสำหรับ {lid}"
        ans_str = "10"

    # Build choices
    opts = [ans_str]
    for _ in range(3):
        off = random.choice([-5,-3,-2,2,3,5,10,15])
        try:
            v = int(ans_str) + off
            if v > 0:
                opts.append(str(v))
        except:
            opts.append(str(random.randint(1,50)))
    while len(opts) < 4:
        opts.append(str(random.randint(1,100)))
    opts = opts[:4]
    random.shuffle(opts)
    ca = opts[0]

    choices_list = [f"A: {opts[0]}", f"B: {opts[1]}", f"C: {opts[2]}", f"D: {opts[3]}"]

    return {
        "question_id": qid(lid, num),
        "grade_level": grade,
        "lesson_id": lid,
        "topic_code": lid,
        "skill_code": lid,
        "question_type": qtype,
        "routine_level": rl,
        "difficulty": diff,
        "confidence_role": conf,
        "question_text_th": q_text,
        "choices": choices_list,
        "correct_answer": ca,
        "explanation_th": "คำตอบคือ " + ca + " ✅",
        "hint_th": "คิดให้ดี",
        "solution_strategy_th": "ใช้การคำนวณ",
        "singapore_math_model": "none",
        "common_wrong_reason_th": "คิดเลขผิด"
    }

for grade, lids in LESSONS.items():
    for lid in lids:
        path = BASE / f"grade_{grade}" / f"{lid}.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        diffs_core = ["easy"]*16 + ["medium"]*12 + ["hard"]*4
        diffs_ch = ["medium"]*4 + ["hard"]*4
        random.shuffle(diffs_core)
        random.shuffle(diffs_ch)
        with open(path, "w", encoding="utf-8") as f:
            for i, d in enumerate(diffs_core):
                q = gen_q(grade, lid, i+1, "core", d)
                f.write(json.dumps(q, ensure_ascii=False) + "\n")
            for i, d in enumerate(diffs_ch):
                q = gen_q(grade, lid, 33+i, "challenge", d)
                f.write(json.dumps(q, ensure_ascii=False) + "\n")
        lines = sum(1 for _ in open(path, encoding="utf-8") if _.strip())
        print(f"Grade {grade} {lid}: {lines} lines")

print("ALL 42 TOPICS GENERATED")