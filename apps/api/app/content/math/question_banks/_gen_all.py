import json, os, random

BASE = r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks"

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
    rl_lv = "routine" if qtype == "core" else "non_routine"
    diff_lv = diff

    if lid == "g4_large_numbers":
        nums = [random.randint(100,9999) for _ in range(4)]
        ans = max(nums)
        ans_i = nums.index(ans)
        opts = [str(n) for n in nums]
        for w in wrong(str(ans), diff): opts.append(w)
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(str(ans))]
        q_text = f"จำนวนในข้อใดมากที่สุด: {nums[0]}, {nums[1]}, {nums[2]}, {nums[3]}"
        hint = "เปรียบเทียบตัวเลขแต่ละจำนวน"
        sol = f"คำตอบคือ {ans}"
        exp = f"{ans} มากที่สุดในกลุ่ม ✅"
        sg = "place_value_chart"

    elif lid == "g4_decimals_intro":
        a = round(random.uniform(0.1, 9.9), 1)
        b = round(random.uniform(0.1, 9.9), 1)
        big = max(a,b)
        ans = f"{big}"
        opts = [f"{a}", f"{b}", f"{round(a+b,1)}", f"{round(abs(a-b),1)}"]
        for w in wrong(str(big), diff): opts.append(w)
        opts = list(set(opts))[:4]
        while len(opts) < 4: opts.append(str(big))
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(str(big))]
        q_text = f"จำนวนในข้อใดมากกว่า: {a} หรือ {b}?"
        hint = "เปรียบเทียบทศนิยม"
        sol = f"{big} มากกว่า"
        exp = f"{big} > {min(a,b)} ✅"
        sg = "number_line"

    elif lid == "g4_fractions":
        d = random.choice([2,3,4,5,6])
        n1 = random.randint(1, d-1)
        n2 = random.randint(1, d-1)
        pairs = [(i,j) for i in range(1,d) for j in range(1,d) if i/j == n1/d or i/j == n2/d]
        if pairs:
            i,j = pairs[0]
            correct_val = f"{i}/{j}" if i*j != n1 else f"{n1}/{d}"
            other = random.choice([x for x in pairs if x != (i,j)])
            opts = [f"{i}/{j}", f"{other[0]}/{other[1]}", f"{n1+n2}/{d}", f"{abs(n1-n2)}/{d}"]
            ca = "A"
        else:
            correct_val = f"{n1}/{d}"
            opts = [f"{n1}/{d}", f"{n1+1}/{d}", f"{n1}/{d+1}", f"{n1+1}/{d+1}"]
            ca = "A"
        random.shuffle(opts)
        ca = ["A","B","C","D"][min(opts.index(f"{i}/{j}") if pairs else opts.index(correct_val), 3)]
        q_text = f"เศษส่วนใดเท่ากับ {correct_val}?"
        hint = "หาคู่ที่มีค่าเท่ากัน"
        sol = f"{correct_val} = {opts[0]}"
        exp = f"{correct_val} เท่ากับ {opts[0]} ✅"
        sg = "fraction_strip"

    elif lid == "g4_multi_digit_operations":
        op = random.choice(["×","÷"])
        if op == "×":
            a = random.randint(100,999)
            b = random.randint(10,99)
            ans = a * b
            q_text = f"{a} × {b} = ?"
        else:
            ans = random.randint(10,99)
            b = random.randint(2,9)
            a = ans * b
            q_text = f"{a} ÷ {b} = ?"
        opts = [str(ans)]
        for w in wrong(str(ans), diff): opts.append(w)
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(str(ans))]
        hint = "คูณหรือหารเลข"
        sol = f"คำตอบคือ {ans}"
        exp = f"{q_text} = {ans} ✅"
        sg = "place_value_chart"

    elif lid == "g4_word_problems":
        items = [
            ("ซื้อปากกา", 15, "ด้าม", "ซื้อปากกา 5 ด้าม ด้ามละ 15 บาท รวมเท่าไร?", "15×5=75", "75 บาท ✅"),
            ("มีลูกชิ้น", 10, "ลูก", "แม่มีลูกชิ้น 48 ลูก แบ่งให้ลูก 4 คน คนละกี่ลูก?", "48÷4=12", "12 ลูก ✅"),
        ]
        (desc, price, unit, q, sol_s, exp_s) = random.choice(items)
        q_text = q
        hint = "ใช้การคูณหรือหาร"
        sol = sol_s
        exp = exp_s
        sg = "bar_model"
        # find ans
        import re
        m = re.search(r'\d+', exp.split("✅")[0])
        ans = m.group() if m else "0"
        opts = [ans]
        for w in wrong(ans, diff): opts.append(w)
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(ans)]

    elif lid == "g5_data_graphs":
        q_text = "จากแผนภูมิ ข้อใดถูกต้อง: สินค้า A มีจำนวน 50 ชิ้น สินค้า B มี 30 ชิ้น สินค้า C มี 70 ชิ้น สินค้าใดมากที่สุด?"
        ans = "สินค้า C"
        opts = ["สินค้า A","สินค้า B","สินค้า C","สินค้า D"]
        ca = "C"
        hint = "ดูแผนภูมิและเปรียบเทียบ"
        sol = "70 > 50 > 30 ดังนั้น C มากที่สุด"
        exp = "สินค้า C มี 70 ชิ้น มากที่สุด ✅"
        sg = "bar_model"

    elif lid == "g5_decimals":
        a = round(random.uniform(1, 9.9), 1)
        b = round(random.uniform(1, 9.9), 1)
        ans = round(a + b, 1)
        q_text = f"{a} + {b} = ?"
        opts = [f"{ans}", f"{round(ans+0.1,1)}", f"{round(ans-0.1,1)}", f"{round(ans+0.5,1)}"]
        for w in wrong(str(ans), diff): opts.append(w)
        opts = list(set(opts))[:4]
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(f"{ans}")]
        hint = "บวกทศนิยม"
        sol = f"{a}+{b}={ans}"
        exp = f"{q_text} = {ans} ✅"
        sg = "place_value_chart"

    elif lid == "g5_fraction_operations":
        a = random.randint(1,5)
        b = random.randint(2,5)
        ans = round(a/b, 2)
        q_text = f"{a} ÷ {b} = ?"
        opts = [f"{ans}", f"{round(ans+0.1,2)}", f"{round(ans-0.1,2)}", f"{round(a*b,2)}"]
        for w in wrong(str(ans), diff): opts.append(w)
        opts = list(set(opts))[:4]
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(f"{ans}")]
        hint = "หารเศษส่วน"
        sol = f"{a}÷{b}={ans}"
        exp = f"{q_text} = {ans} ✅"
        sg = "fraction_strip"

    elif lid == "g5_multi_step_word_problems":
        steps = [
            ("ซื้อสมุด 25 บาท 2 เล่ม และดินสอ 10 บาท 3 แท่ง รวมเท่าไร?", "25×2+10×3=80", "80 บาท ✅"),
            ("มีเงิน 100 บาท ซื้อของ 35 บาท และ 45 บาท เหลือเท่าไร?", "100-35-45=20", "20 บาท ✅"),
        ]
        q_text, sol_s, exp_s = random.choice(steps)
        import re
        m = re.search(r'\d+', exp_s.split("✅")[0])
        ans = m.group() if m else "0"
        opts = [ans]
        for w in wrong(ans, diff): opts.append(w)
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(ans)]
        hint = "ทำทีละขั้นตอน"
        sol = sol_s
        exp = exp_s
        sg = "bar_model"

    elif lid == "g5_volume_area":
        l, w, h = random.randint(2,5), random.randint(2,5), random.randint(2,5)
        vol = l*w*h
        q_text = f"กล่องทรงลูกบาศก์ กว้าง {l} ยาว {w} สูง {h} หน่วย มีปริมาตรเท่าไร?"
        ans = str(vol)
        opts = [ans]
        for w in wrong(ans, diff): opts.append(w)
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(ans)]
        hint = "ปริมาตร = กว้าง × ยาว × สูง"
        sol = f"{l}×{w}×{h}={vol}"
        exp = f"ปริมาตร = {l}×{w}×{h} = {vol} ลูกบาศก์หน่วย ✅"
        sg = "area_model"

    elif lid == "g6_equations_intro":
        t = random.choice(["x", "y"])
        if random.random() < 0.5:
            a = random.randint(2,9)
            b = random.randint(1,20)
            ans = b - a
            q_text = f"{t} + {a} = {b} แล้ว {t} = ?"
        else:
            a = random.randint(2,9)
            b = random.randint(2,20)
            ans = b // a
            q_text = f"{a} × {t} = {b} แล้ว {t} = ?"
        opts = [str(ans)]
        for w in wrong(str(ans), diff): opts.append(w)
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(str(ans))]
        hint = f"แก้สมการหาค่า {t}"
        sol = f"{t} = {ans}"
        exp = f"{q_text} → {t} = {ans} ✅"
        sg = "bar_model"

    elif lid == "g6_middle_school_prep":
        ops = [
            ("3 + 5 × 2 = ?", "13", "ลำดับ运算"),
            ("(3 + 5) × 2 = ?", "16", "วงเล็บก่อน"),
            ("12 ÷ 3 - 2 = ?", "2", "หารก่อนลบ"),
        ]
        q_text, ans, hint = random.choice(ops)
        opts = [ans]
        for w in wrong(ans, diff): opts.append(w)
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(ans)]
        exp = f"{q_text} = {ans} ✅"
        sol = f"{q_text} = {ans}"
        sg = "number_line"

    elif lid == "g6_ratio_proportion":
        a = random.randint(2,5)
        b = random.randint(2,5)
        ratio = f"{a}:{b}"
        actual_a = a * random.randint(3,6)
        actual_b = b * (actual_a // a)
        q_text = f"อัตราส่วน {ratio} ถ้ามี {a} หน่วย ได้ {b} หน่วย ถ้ามี {actual_a} หน่วยจะได้เท่าไร?"
        ans_num = actual_b
        ans = str(ans_num)
        opts = [ans]
        for w in wrong(ans, diff): opts.append(w)
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(ans)]
        hint = "ใช้สัดส่วน"
        sol = f"{a}:{b} = {actual_a}:{ans_num}"
        exp = f"จากสัดส่วน {a}:{b} = {actual_a}:{ans_num} ✅"
        sg = "bar_model"

    elif lid == "g6_volume":
        r = random.randint(2,5)
        q_text = f"ทรงกลมมีรัศมี {r} หน่วย ปริมาตรเท่าไร (ใช้ π ≈ 3.14)?"
        vol = round(4/3 * 3.14 * r**3, 1)
        ans = str(vol)
        opts = [ans]
        for w in wrong(ans, diff): opts.append(w)
        random.shuffle(opts)
        ca = ["A","B","C","D"][opts.index(ans)]
        hint = "ใช้สูตร V = 4/3 × π × r³"
        sol = f"4/3 × 3.14 × {r}³ = {vol}"
        exp = f"ปริมาตร = {vol} ลูกบาศก์หน่วย ✅"
        sg = "area_model"

    else:
        q_text = f"คำถามตัวอย่างสำหรับ {lid}"
        ans = "A"
        opts = ["A: คำตอบ A", "B: คำตอบ B", "C: คำตอบ C", "D: คำตอบ D"]
        ca = "A"
        hint = "ตอบ A"
        sol = "A"
        exp = "คำตอบคือ A ✅"
        sg = "none"

    choices_list = [f"A: {opts[0]}", f"B: {opts[1]}", f"C: {opts[2]}", f"D: {opts[3]}"]

    q = {
        "question_id": qid(lid, num),
        "grade_level": grade,
        "lesson_id": lid,
        "topic_code": lid,
        "skill_code": lid,
        "question_type": qtype,
        "routine_level": rl_lv,
        "difficulty": diff_lv,
        "confidence_role": conf,
        "question_text_th": q_text,
        "choices": choices_list,
        "correct_answer": ca,
        "explanation_th": exp,
        "hint_th": hint,
        "solution_strategy_th": sol,
        "singapore_math_model": sg,
        "common_wrong_reason_th": "คิดเลขผิด"
    }
    return q

def gen_file(grade, lid):
    path = os.path.join(BASE, f"grade_{grade}", f"{lid}.jsonl")
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
    lines = open(path, encoding="utf-8").readlines()
    print(f"{lid}: {len(lines)} lines")
    return len(lines)

if __name__ == "__main__":
    for grade, lids in LESSONS.items():
        for lid in lids:
            try:
                gen_file(grade, lid)
            except Exception as e:
                print(f"ERROR {lid}: {e}")
    print("DONE")