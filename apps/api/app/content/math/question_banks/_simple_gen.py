#!/usr/bin/env python3
"""Simple gen for grade 4-6"""
import json, os, random, pathlib

BASE = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')

LESSONS = {
    4: ["g4_large_numbers","g4_decimals_intro","g4_fractions","g4_multi_digit_operations","g4_word_problems"],
    5: ["g5_data_graphs","g5_decimals","g5_fraction_operations","g5_multi_step_word_problems","g5_volume_area"],
    6: ["g6_equations_intro","g6_middle_school_prep","g6_ratio_proportion","g6_volume"]
}

def qid(lid, n):
    return f"{lid}_q{n:03d}"

def wrong(ans, diff):
    offsets = {"easy": [-3,-2,-1,1,2,3], "medium": [-8,-5,-3,3,5,8], "hard": [-15,-10,-5,5,10,15]}
    w = set()
    a = int(ans)
    while len(w) < 3:
        off = random.choice(offsets[diff])
        n = a + off
        if n > 0 and str(n) != ans:
            w.add(str(n))
    return list(w)

def make_q(grade, lid, num, qtype, diff):
    conf = "build_confidence" if qtype == "core" else "stretch_thinking"
    rl = "routine" if qtype == "core" else "non_routine"

    if lid == "g4_large_numbers":
        nums = sorted([random.randint(100,9999) for _ in range(4)], reverse=True)
        ans_val = nums[0]
        q_text = f"จำนวนในข้อใดมากที่สุด: {nums[3]}, {nums[1]}, {nums[0]}, {nums[2]}"
        opts = [str(n) for n in nums[:3]]
        for w in wrong(str(ans_val), diff):
            if len(opts) < 4:
                opts.append(w)
        while len(opts) < 4:
            opts.append(str(ans_val + random.randint(1,10)))
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g4_decimals_intro":
        a = round(random.uniform(0.1, 9.9), 1)
        b = round(random.uniform(0.1, 9.9), 1)
        big = max(a,b)
        q_text = f"จำนวนในข้อใดมากกว่า: {a} หรือ {b}?"
        opts = [f"{a}", f"{b}", f"{round(a+b,1)}", f"{round(abs(a-b),1)}"]
        ca = opts[0] if big == a else opts[1]
        random.shuffle(opts)
        ca = opts[opts.index(f"{big}")]

    elif lid == "g4_fractions":
        d = random.choice([2,3,4,5,6])
        n1 = random.randint(1, d-1)
        correct_val = f"{n1}/{d}"
        opts = [f"{n1}/{d}", f"{n1+1}/{d}", f"{n1}/{d+1}", f"{n1+1}/{d+1}"]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g4_multi_digit_operations":
        op = random.choice(["×","÷"])
        if op == "×":
            a = random.randint(100,999)
            b = random.randint(10,99)
            ans_val = a * b
            q_text = f"{a} × {b} = ?"
        else:
            ans_val = random.randint(10,99)
            b = random.randint(2,9)
            a = ans_val * b
            q_text = f"{a} ÷ {b} = ?"
        opts = [str(ans_val)]
        for w in wrong(str(ans_val), diff):
            if len(opts) < 4:
                opts.append(w)
        while len(opts) < 4:
            opts.append(str(ans_val + random.randint(1,10)))
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g4_word_problems":
        items = [
            ("ซื้อปากกา 5 ด้าม ด้ามละ 15 บาท รวมเท่าไร?", "75"),
            ("แม่มีลูกชิ้น 48 ลูก แบ่งให้ลูก 4 คน คนละกี่ลูก?", "12"),
        ]
        q_text, ans_str = random.choice(items)
        opts = [ans_str]
        for w in wrong(ans_str, diff):
            if len(opts) < 4:
                opts.append(w)
        while len(opts) < 4:
            opts.append(str(int(ans_str) + random.randint(1,5)))
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g5_data_graphs":
        vals = sorted([random.randint(20,80) for _ in range(4)], reverse=True)
        q_text = f"สินค้า A={vals[0]} ชิ้น B={vals[1]} ชิ้น C={vals[2]} ชิ้น D={vals[3]} ชิ้น สินค้าใดมากที่สุด?"
        opts = ["สินค้า A","สินค้า B","สินค้า C","สินค้า D"]
        ca = "สินค้า A"
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g5_decimals":
        a = round(random.uniform(1, 9.9), 1)
        b = round(random.uniform(1, 9.9), 1)
        ans_val = round(a + b, 1)
        q_text = f"{a} + {b} = ?"
        opts = [f"{ans_val}", f"{round(ans_val+0.5,1)}", f"{round(ans_val-0.5,1)}", f"{round(a+b+0.3,1)}"]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g5_fraction_operations":
        a = random.randint(1,5)
        b = random.randint(2,5)
        ans_val = round(a/b, 2)
        q_text = f"{a} ÷ {b} = ?"
        opts = [f"{ans_val}", f"{round(ans_val+0.1,2)}", f"{round(a*b,2)}", f"{round(a-b,2)}"]
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g5_multi_step_word_problems":
        steps = [
            ("ซื้อสมุด 25 บาท 2 เล่ม และดินสอ 10 บาท 3 แท่ง รวมเท่าไร?", "80"),
            ("มีเงิน 100 บาท ซื้อของ 35 บาท และ 45 บาท เหลือเท่าไร?", "20"),
        ]
        q_text, ans_str = random.choice(steps)
        opts = [ans_str]
        for w in wrong(ans_str, diff):
            if len(opts) < 4:
                opts.append(w)
        while len(opts) < 4:
            opts.append(str(int(ans_str) + random.randint(1,5)))
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g5_volume_area":
        l, w, h = random.randint(2,5), random.randint(2,5), random.randint(2,5)
        ans_val = l*w*h
        q_text = f"กล่องกว้าง {l} ยาว {w} สูง {h} หน่วย ปริมาตรเท่าไร?"
        opts = [str(ans_val)]
        for w in wrong(str(ans_val), diff):
            if len(opts) < 4:
                opts.append(w)
        while len(opts) < 4:
            opts.append(str(ans_val + random.randint(1,5)))
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g6_equations_intro":
        t = random.choice(["x", "y"])
        a = random.randint(2,9)
        b = random.randint(1,20)
        ans_val = b - a
        q_text = f"{t} + {a} = {b} แล้ว {t} = ?"
        opts = [str(ans_val)]
        for w in wrong(str(ans_val), diff):
            if len(opts) < 4:
                opts.append(w)
        while len(opts) < 4:
            opts.append(str(ans_val + random.randint(1,5)))
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g6_middle_school_prep":
        ops = [
            ("3 + 5 × 2 = ?", "13"),
            ("(3 + 5) × 2 = ?", "16"),
            ("12 ÷ 3 - 2 = ?", "2"),
        ]
        q_text, ans_str = random.choice(ops)
        opts = [ans_str]
        for w in wrong(ans_str, diff):
            if len(opts) < 4:
                opts.append(w)
        while len(opts) < 4:
            opts.append(str(int(ans_str) + random.randint(1,5)))
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g6_ratio_proportion":
        a = random.randint(2,5)
        b = random.randint(2,5)
        actual_a = a * random.randint(3,6)
        actual_b = b * (actual_a // a)
        q_text = f"อัตราส่วน {a}:{b} ถ้ามี {a} หน่วยได้ {b} หน่วย ถ้ามี {actual_a} หน่วยจะได้เท่าไร?"
        ans_val = actual_b
        opts = [str(ans_val)]
        for w in wrong(str(ans_val), diff):
            if len(opts) < 4:
                opts.append(w)
        while len(opts) < 4:
            opts.append(str(ans_val + random.randint(1,5)))
        random.shuffle(opts)
        ca = opts[0]

    elif lid == "g6_volume":
        r = random.randint(2,5)
        ans_val = round(4/3 * 3.14 * r**3, 1)
        q_text = f"ทรงกลมมีรัศมี {r} หน่วย ปริมาตรเท่าไร (π ≈ 3.14)?"
        opts = [str(ans_val)]
        for w in wrong(str(ans_val), diff):
            if len(opts) < 4:
                opts.append(w)
        while len(opts) < 4:
            opts.append(str(ans_val + random.randint(1,5)))
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

    q = {
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
    return q

def gen_file(grade, lid):
    path = BASE / f"grade_{grade}" / f"{lid}.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    diffs_core = ["easy"]*16 + ["medium"]*12 + ["hard"]*4
    diffs_ch = ["medium"]*4 + ["hard"]*4
    random.shuffle(diffs_core)
    random.shuffle(diffs_ch)
    with open(path, "w", encoding="utf-8") as f:
        for i, d in enumerate(diffs_core):
            q = make_q(grade, lid, i+1, "core", d)
            f.write(json.dumps(q, ensure_ascii=False) + "\n")
        for i, d in enumerate(diffs_ch):
            q = make_q(grade, lid, 33+i, "challenge", d)
            f.write(json.dumps(q, ensure_ascii=False) + "\n")
    lines = sum(1 for _ in open(path, encoding="utf-8") if _.strip())
    print(f"{lid}: {lines} lines")
    return lines

if __name__ == "__main__":
    for grade, lids in LESSONS.items():
        for lid in lids:
            try:
                gen_file(grade, lid)
            except Exception as e:
                print(f"ERROR {lid}: {e}")
    print("DONE")