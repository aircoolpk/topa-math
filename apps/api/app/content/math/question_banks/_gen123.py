#!/usr/bin/env python3
"""Generate grades 1-3 math question banks"""
import json, os, random, pathlib

BASE = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')

LESSONS = {
    1: ["g1_counting_20","g1_add_one_digit","g1_subtract_one_digit","g1_compare_numbers","g1_number_order","g1_shapes_2d_basic","g1_position_direction"],
    2: ["g2_add_two_digit","g2_subtract_two_digit","g2_multiplication_intro","g2_times_table_2_5_10","g2_money_change","g2_time_calendar","g2_shapes_2d"],
    3: ["g3_multiplication_multi_digit","g3_division_intro","g3_fractions_intro","g3_multi_step_word_problems","g3_measurement","g3_area_intro","g3_mixed_review"],
}

def qid(lid, n):
    return f"{lid}_q{n:03d}"

def gen_q(grade, lid, num, qtype, diff):
    conf = "build_confidence" if qtype == "core" else "stretch_thinking"
    rl = "routine" if qtype == "core" else "non_routine"

    # Grade 1
    if lid == "g1_counting_20":
        if diff == "easy":
            n = random.randint(1, 20)
            q_text = f"เลข {n} เขียนเป็นตัวเลขอารบิกว่าอะไร?"
            ans_str = str(n)
        elif diff == "medium":
            n = random.randint(1, 20)
            q_text = f"เลข {n} อยู่ก่อนเลขอะไร?"
            ans_str = str(n+1) if n < 20 else "21"
        else:
            nums = random.sample(range(1,21), 4)
            biggest = max(nums)
            q_text = f"จำนวนในข้อใดมากที่สุด: {nums[0]}, {nums[1]}, {nums[2]}, {nums[3]}"
            ans_str = str(biggest)
        opts = [ans_str, str(int(ans_str)+1), str(int(ans_str)-1 if int(ans_str)>1 else int(ans_str)+2), str(int(ans_str)+2)]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g1_add_one_digit":
        a = random.randint(1,9)
        b = random.randint(1,9)
        ans_val = a + b
        q_text = f"{a} + {b} = ?"
        ans_str = str(ans_val)
        opts = [ans_str, str(ans_val+random.randint(1,3)), str(ans_val-1 if ans_val>1 else ans_val+2), str(ans_val+random.randint(1,5))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g1_subtract_one_digit":
        a = random.randint(5,18)
        b = random.randint(1, a-1)
        ans_val = a - b
        q_text = f"{a} - {b} = ?"
        ans_str = str(ans_val)
        opts = [ans_str, str(ans_val+1), str(ans_val-1 if ans_val>1 else ans_val+2), str(ans_val+random.randint(1,3))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g1_compare_numbers":
        a = random.randint(1,19)
        b = a + random.randint(1,5)
        if b > 20: b = 20
        if random.random() < 0.5:
            q_text = f"เลข {a} กับ {b} เลขไหนมากกว่า?"
            ans_str = str(b)
        else:
            q_text = f"เลข {a} กับ {b} เลขไหนน้อยกว่า?"
            ans_str = str(a)
        opts = [str(a), str(b), str(max(a,b)+1), str(min(a,b)-1 if min(a,b)>1 else str(min(a,b)+2))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g1_number_order":
        nums = sorted(random.sample(range(1,21), 4))
        if random.random() < 0.5:
            q_text = f"เรียงจากน้อยไปมาก: {nums[3]}, {nums[0]}, {nums[2]}, {nums[1]}"
            ans_str = f"{nums[0]}, {nums[1]}, {nums[2]}, {nums[3]}"
        else:
            q_text = f"เรียงจากมากไปน้อย: {nums[0]}, {nums[2]}, {nums[1]}, {nums[3]}"
            ans_str = f"{nums[3]}, {nums[2]}, {nums[1]}, {nums[0]}"
        opts = [ans_str, f"{nums[1]}, {nums[0]}, {nums[2]}, {nums[3]}", f"{nums[0]}, {nums[2]}, {nums[1]}, {nums[3]}", f"{nums[2]}, {nums[0]}, {nums[1]}, {nums[3]}"]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g1_shapes_2d_basic":
        shapes = ["วงกลม","สามเหลี่ยม","สี่เหลี่ยม","ห้าเหลี่ยม"]
        name = random.choice(shapes)
        corners = {"วงกลม":0,"สามเหลี่ยม":3,"สี่เหลี่ยม":4,"ห้าเหลี่ยม":5}[name]
        q_text = f"{name} มีกี่มุม?"
        ans_str = str(corners)
        opts = [ans_str, str(corners+1), str(corners-1 if corners>0 else corners+2), str(corners+2)]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g1_position_direction":
        dirs = ["ซ้าย","ขวา","บน","ล่าง","หน้า","หลัง"]
        d = random.choice(dirs)
        q_text = f"ถ้าเดินไปทาง{d} แล้วเลี้ยวขวา แล้วเลี้ยวซ้าย ตอนนี้หันไปทางไหน?"
        ans_str = "เดิมทาง"
        opts = ["เดิมทาง", "ซ้าย", "ขวา", "กลับทาง"]
        random.shuffle(opts)
        ca = opts[0]

    # Grade 2
    elif lid == "g2_add_two_digit":
        a = random.randint(10,99)
        b = random.randint(10,99)
        ans_val = a + b
        q_text = f"{a} + {b} = ?"
        ans_str = str(ans_val)
        opts = [ans_str, str(ans_val+random.randint(1,10)), str(ans_val-10 if ans_val>10 else str(ans_val+20)), str(ans_val+random.randint(1,20))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g2_subtract_two_digit":
        a = random.randint(50,99)
        b = random.randint(10, a-1)
        ans_val = a - b
        q_text = f"{a} - {b} = ?"
        ans_str = str(ans_val)
        opts = [ans_str, str(ans_val+5), str(ans_val-5 if ans_val>5 else str(ans_val+15)), str(ans_val+random.randint(1,10))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g2_multiplication_intro":
        a = random.randint(2,5)
        b = random.randint(1,5)
        ans_val = a * b
        q_text = f"{a} × {b} = ?"
        ans_str = str(ans_val)
        opts = [ans_str, str(ans_val+random.randint(1,5)), str(ans_val-2 if ans_val>2 else str(ans_val+5)), str(ans_val+random.randint(1,10))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g2_times_table_2_5_10":
        table = random.choice([2,5,10])
        n = random.randint(1,10)
        ans_val = table * n
        q_text = f"{table} × {n} = ?"
        ans_str = str(ans_val)
        opts = [ans_str, str(ans_val+table), str(ans_val-table if ans_val>table else str(ans_val+table*2)), str(ans_val+random.randint(1,table*2))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g2_money_change":
        price = random.randint(5,95)
        paid = price + random.randint(5,95)
        change = paid - price
        q_text = f"ของราคา {price} บาท จ่ายเงิน {paid} บาท ได้เงินทอนกี่บาท?"
        ans_str = str(change)
        opts = [ans_str, str(change+5), str(change-5 if change>5 else str(change+15)), str(change+random.randint(1,20))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g2_time_calendar":
        h1 = random.randint(1,11)
        h2 = h1 + random.randint(1,5)
        if h2 > 12: h2 = 12
        q_text = f"เด็กเริ่มเข้าเรียนเวลา {h1} โมง จบเวลา {h2} โมง รวมเวลาเรียนกี่ชั่วโมง?"
        ans_str = str(h2 - h1)
        opts = [ans_str, str(h2-h1+1), str(h2-h1-1 if h2-h1>1 else str(h2-h1+2)), str(h2-h1+random.randint(1,3))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g2_shapes_2d":
        shapes = [("วงกลม",0,0),("สามเหลี่ยม",3,3),("สี่เหลี่ยม",4,4),("ห้าเหลี่ยม",5,5),("หกเหลี่ยม",6,6)]
        name, corners, sides = random.choice(shapes)
        if random.random() < 0.5:
            q_text = f"{name} มีกี่มุม?"
            ans_str = str(corners)
            opts = [ans_str, str(corners+1), str(corners-1 if corners>0 else str(corners+2)), str(corners+2)]
        else:
            q_text = f"{name} มีกี่ด้าน?"
            ans_str = str(sides)
            opts = [ans_str, str(sides+1), str(sides-1 if sides>0 else str(sides+2)), str(sides+2)]
        random.shuffle(opts)
        ca = opts[0]

    # Grade 3
    elif lid == "g3_multiplication_multi_digit":
        a = random.randint(10,99)
        b = random.randint(2,5)
        ans_val = a * b
        q_text = f"{a} × {b} = ?"
        ans_str = str(ans_val)
        opts = [ans_str, str(ans_val+random.randint(1,20)), str(ans_val-10 if ans_val>10 else str(ans_val+30)), str(ans_val+random.randint(1,50))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g3_division_intro":
        b = random.randint(2,9)
        ans_val = random.randint(2,9)
        a = ans_val * b
        q_text = f"{a} ÷ {b} = ?"
        ans_str = str(ans_val)
        opts = [ans_str, str(ans_val+1), str(ans_val-1 if ans_val>1 else str(ans_val+3)), str(ans_val+random.randint(1,5))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g3_fractions_intro":
        d = random.choice([2,3,4,5])
        n = random.randint(1, d-1)
        ans_str = f"{n}/{d}"
        q_text = f"เศษส่วนที่มีค่าเท่ากับ {n}/{d} คือข้อใด?"
        opts = [f"{n}/{d}", f"{n+1}/{d}", f"{n}/{d+1}", f"{n+1}/{d+1}"]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g3_multi_step_word_problems":
        steps = [
            ("ซื้อปากกา 3 ด้าม ด้ามละ 15 บาท และยางลบ 2 ด้าม ด้ามละ 10 บาท รวมเท่าไร?", "65"),
            ("แม่มีผลไม้ 25 ผล แบ่งให้ลูก 5 คน คนละกี่ผล?", "5"),
        ]
        q_text, ans_str = random.choice(steps)
        opts = [ans_str, str(int(ans_str)+5), str(int(ans_str)-5 if int(ans_str)>5 else str(int(ans_str)+15)), str(int(ans_str)+random.randint(1,10))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g3_measurement":
        l = random.randint(10,99)
        w = random.randint(5, l-1)
        p = 2 * (l + w)
        q_text = f"สี่เหลี่ยมกว้าง {w} ยาว {l} หน่วย เส้นรอบรูปยาวกี่หน่วย?"
        ans_str = str(p)
        opts = [ans_str, str(p+5), str(p-5 if p>5 else str(p+15)), str(p+random.randint(1,10))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g3_area_intro":
        l = random.randint(2,8)
        w = random.randint(2,8)
        area = l * w
        q_text = f"สี่เหลี่ยมกว้าง {w} ยาว {l} หน่วย มีพื้นที่เท่าไร?"
        ans_str = str(area)
        opts = [ans_str, str(area+4), str(area-4 if area>4 else str(area+12)), str(area+random.randint(1,8))]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g3_mixed_review":
        ops = [
            (f"{random.randint(50,99)} + {random.randint(10,49)} = ?", "บวก"),
            (f"{random.randint(80,99)} - {random.randint(10,40)} = ?", "ลบ"),
            (f"{random.randint(2,5)} × {random.randint(2,9)} = ?", "คูณ"),
            (f"{random.randint(10,45)} ÷ {random.randint(2,9)} = ?", "หาร"),
        ]
        q_text, op_type = random.choice(ops)
        # Extract answer from q_text for now, just use simple answer
        if op_type == "บวก":
            nums = [int(s) for s in q_text.split("+")[0].split()]
            ans_val = nums[0] + int(q_text.split("+")[1].split("=")[0].strip())
        elif op_type == "ลบ":
            nums = [int(s) for s in q_text.split("-")[0].split()]
            ans_val = nums[0] - int(q_text.split("-")[1].split("=")[0].strip())
        elif op_type == "คูณ":
            parts = q_text.split("×")
            ans_val = int(parts[0].split()[-1]) * int(parts[1].split("=")[0].strip())
        else:
            parts = q_text.split("÷")
            a = int(parts[0].split()[-1])
            b = int(parts[1].split("=")[0].strip())
            ans_val = a // b
        ans_str = str(ans_val)
        opts = [ans_str, str(ans_val+random.randint(1,10)), str(ans_val-5 if ans_val>5 else str(ans_val+15)), str(ans_val+random.randint(1,20))]
        random.shuffle(opts)
        ca = opts[0]

    else:
        q_text = f"คำถามสำหรับ {lid}"
        ans_str = "10"
        opts = ["10","20","30","40"]
        ca = "10"
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

print("GRADE 1-3 DONE")