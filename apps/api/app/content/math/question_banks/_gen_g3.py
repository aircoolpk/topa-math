import json, os, random, math

BASE = r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_3"
os.makedirs(BASE, exist_ok=True)

def qid(lid, n):
    return f"{lid}_q{n:03d}"

def make_choices(correct, diff):
    offsets = {"easy": [-3,-2,-1,1,2,3], "medium": [-8,-5,-3,3,5,8], "hard": [-15,-10,-5,5,10,15]}
    c = int(correct)
    opts_set = {correct}
    for off in offsets[diff]:
        v = c + off
        if v > 0:
            opts_set.add(str(v))
            if len(opts_set) >= 4:
                break
    opts = list(opts_set)[:4]
    while len(opts) < 4:
        extra = c + len(opts) + 1
        opts.append(str(extra))
    random.shuffle(opts)
    ca = ["A","B","C","D"][opts.index(correct)]
    return [f"A: {opts[0]}", f"B: {opts[1]}", f"C: {opts[2]}", f"D: {opts[3]}"], ca

def make_q(grade, lid, n, qtype, diff):
    conf = "build_confidence" if qtype == "core" else "stretch_thinking"
    rl = "routine" if qtype == "core" else "non_routine"
    q = {"question_id": qid(lid,n), "grade_level": grade, "lesson_id": lid, "topic_code": lid, "skill_code": lid, "question_type": qtype, "routine_level": rl, "difficulty": diff, "confidence_role": conf, "question_text_th": "", "choices": [], "correct_answer": "A", "explanation_th": "", "hint_th": "", "solution_strategy_th": "", "singapore_math_model": "none", "common_wrong_reason_th": "คิดเลขผิด"}
    c = ""; h = ""; s = ""; e = ""; sg = "none"

    if lid == "g3_multiplication_multi_digit":
        a = random.randint(10,99); b = random.randint(2,9)
        c = str(a*b); q_text = f"{a} x {b} = ?"
        h = "คูณเลขทีละหลัก"; s = f"{a}x{b}={c}"; e = f"{a}x{b}={c} ✅"; sg = "place_value_chart"

    elif lid == "g3_division_intro":
        b = random.randint(2,9); c = random.randint(2,12); a = b*c
        q_text = f"{a} / {b} = ?"
        h = "หารเลข"; s = f"{a}/{b}={c}"; e = f"{a}/{b}={c} ✅"; sg = "number_line"

    elif lid == "g3_fractions_intro":
        d = random.randint(2,8); n1 = random.randint(1,d-1)
        k = random.randint(2,4); correct_num = n1*k; correct_den = d*k
        c = f"{correct_num}/{correct_den}"
        q_text = f"เศษส่วนที่เท่ากับ {n1}/{d} คือข้อใด?"
        h = "คูณเศษส่วนด้วยตัวเลขเดียวกัน"
        s = f"{n1}/{d} x {k}/{k} = {correct_num}/{correct_den}"
        e = f"{n1}/{d} = {correct_num}/{correct_den} ✅"; sg = "fraction_strip"
        # Build choices as fractions
        opts_set = {c}
        k2 = random.randint(2,5)
        opts_set.add(f"{n1*k2}/{d*k2}")
        opts_set.add(f"{n1}/{d}")
        opts_set.add(f"{n1+1}/{d}")
        opts = list(opts_set)[:4]
        while len(opts) < 4:
            extra = f"{n1+len(opts)}/{d}"
            opts.append(extra)
        random.shuffle(opts)
        if c not in opts: opts[0] = c
        ca = ["A","B","C","D"][opts.index(c)]
        q["choices"] = [f"A: {opts[0]}", f"B: {opts[1]}", f"C: {opts[2]}", f"D: {opts[3]}"]
        q["correct_answer"] = ca
        q["question_text_th"] = q_text
        q["explanation_th"] = e
        q["hint_th"] = h
        q["solution_strategy_th"] = s
        q["singapore_math_model"] = sg
        return q

    elif lid == "g3_multi_step_word_problems":
        steps = [
            ("ซื้อสมุด 25 บาท 2 เล่ม และดินสอ 10 บาท 3 แท่ง รวมเท่าไร?", "25*2+10*3=80", "80 บาท ✅", "80"),
            ("มีเงิน 100 บาท ซื้อของ 35 บาท และ 45 บาท เหลือเท่าไร?", "100-35-45=20", "20 บาท ✅", "20"),
        ]
        q_text, sol_s, exp_s, c = random.choice(steps)
        h = "ทำทีละขั้นตอน"; s = sol_s; e = exp_s
        choices, ca = make_choices(c, diff)
        q["question_text_th"] = q_text
        q["choices"] = choices
        q["correct_answer"] = ca
        q["explanation_th"] = e
        q["hint_th"] = h
        q["solution_strategy_th"] = s
        q["singapore_math_model"] = "bar_model"
        return q

    elif lid == "g3_measurement":
        units = [("cm","มิลลิเมตร",10),("m","เซนติเมตร",100),("km","เมตร",1000)]
        unit_big, unit_small, scale = random.choice(units)
        val_small = random.randint(1,99)*scale
        val_big = val_small // scale
        q_text = f"{val_small} {unit_small} เท่ากับกี่ {unit_big}?"
        c = str(val_big); h = f"100 {unit_small} = 1 {unit_big}"; s = f"{val_small}/{scale}={val_big}"; e = f"{val_small}{unit_small}={val_big}{unit_big} ✅"; sg = "place_value_chart"
        choices, ca = make_choices(c, diff)
        q["question_text_th"] = q_text
        q["choices"] = choices
        q["correct_answer"] = ca
        q["explanation_th"] = e
        q["hint_th"] = h
        q["solution_strategy_th"] = s
        q["singapore_math_model"] = sg
        return q

    elif lid == "g3_area_intro":
        w = random.randint(2,10); h = random.randint(2,10); area = w*h
        q_text = f"สี่เหลี่ยมผืนผ้ากว้าง {w} ยาว {h} มีพื้นที่เท่าไร?"
        c = str(area); h = "กว้างxยาว"; s = f"{w}x{h}={area}"; e = f"พื้นที่={w}x{h}={area} ตร.หน่วย ✅"; sg = "area_model"
        choices, ca = make_choices(c, diff)
        q["question_text_th"] = q_text
        q["choices"] = choices
        q["correct_answer"] = ca
        q["explanation_th"] = e
        q["hint_th"] = h
        q["solution_strategy_th"] = s
        q["singapore_math_model"] = sg
        return q

    elif lid == "g3_mixed_review":
        ops = [
            (f"{random.randint(10,99)} + {random.randint(10,99)} = ?", "บวก"),
            (f"{random.randint(30,99)} - {random.randint(10,30)} = ?", "ลบ"),
            (f"{random.randint(2,5)} x {random.randint(2,9)} = ?", "คูณ"),
        ]
        q_text, op_name = random.choice(ops)
        h = op_name; s = "คำนวณ"; e = "✅"; sg = "none"
        # Extract numbers from q_text
        import re
        nums = re.findall(r'\d+', q_text)
        if op_name == "บวก": c = str(int(nums[0])+int(nums[1]))
        elif op_name == "ลบ": c = str(int(nums[0])-int(nums[1]))
        else: c = str(int(nums[0])*int(nums[1]))
        choices, ca = make_choices(c, diff)
        q["question_text_th"] = q_text
        q["choices"] = choices
        q["correct_answer"] = ca
        q["explanation_th"] = e
        q["hint_th"] = h
        q["solution_strategy_th"] = s
        q["singapore_math_model"] = sg
        return q

    choices, ca = make_choices(c, diff)
    q["question_text_th"] = q_text
    q["choices"] = choices
    q["correct_answer"] = ca
    q["explanation_th"] = e
    q["hint_th"] = h
    q["solution_strategy_th"] = s
    q["singapore_math_model"] = sg
    return q

def gen_file(lid):
    path = os.path.join(BASE, f"{lid}.jsonl")
    diffs_core = ["easy"]*16 + ["medium"]*12 + ["hard"]*4
    diffs_ch = ["medium"]*4 + ["hard"]*4
    random.shuffle(diffs_core); random.shuffle(diffs_ch)
    lines = []
    for i,d in enumerate(diffs_core):
        lines.append(json.dumps(make_q(3,lid,i+1,"core",d), ensure_ascii=False))
    for i,d in enumerate(diffs_ch):
        lines.append(json.dumps(make_q(3,lid,33+i,"challenge",d), ensure_ascii=False))
    with open(path,"w",encoding="utf-8") as f:
        f.write("\n".join(lines)+"\n")
    count = len(open(path,encoding="utf-8").readlines())
    print(f"{lid}: {count} lines")

for lid in ["g3_multiplication_multi_digit","g3_division_intro","g3_fractions_intro","g3_multi_step_word_problems","g3_measurement","g3_area_intro","g3_mixed_review"]:
    gen_file(lid)
print("DONE")
