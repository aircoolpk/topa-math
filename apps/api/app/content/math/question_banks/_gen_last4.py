import json, os, random, re

BASE = r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks"

def qid(lid, n):
    return f"{lid}_q{n:03d}"

def wrong_ans(ans, diff):
    offsets = {"easy": [-3,-2,-1,1,2,3], "medium": [-8,-5,-3,3,5,8], "hard": [-15,-10,-5,5,10,15]}
    a = int(ans) if str(ans).isdigit() else float(ans)
    w = set()
    while len(w) < 3:
        off = random.choice(offsets[diff])
        n = a + off
        if (isinstance(a, int) and n > 0) or (isinstance(a, float) and n > 0):
            w.add(str(int(n)) if isinstance(a, int) else str(round(n, 2)))
    return list(w)

def make_choices(correct_str, diff):
    opts = [correct_str]
    w = wrong_ans(correct_str, diff)
    for x in w:
        if x not in opts:
            opts.append(x)
    while len(opts) < 4:
        opts.append(str(int(correct_str) + 1) if correct_str.isdigit() else str(float(correct_str) + 0.5))
    random.shuffle(opts)
    ca = ["A","B","C","D"][opts.index(correct_str)]
    return [f"A: {opts[0]}", f"B: {opts[1]}", f"C: {opts[2]}", f"D: {opts[3]}"], ca

def g4_large_numbers(n, qtype, diff):
    grade = 4; lid = "g4_large_numbers"
    conf = "build_confidence" if qtype == "core" else "stretch_thinking"
    rl = "routine" if qtype == "core" else "non_routine"
    nums = [random.randint(100, 9999) for _ in range(4)]
    correct = str(max(nums))
    choices, ca = make_choices(correct, diff)
    q_text = f"จำนวนในข้อใดมากที่สุด: {', '.join(str(x) for x in nums)}"
    hint = "เปรียบเทียบตัวเลขแต่ละจำนวน"
    sol = f"คำตอบคือ {correct}"
    exp = f"{correct} มากที่สุดในกลุ่ม ✅"
    sg = "place_value_chart"
    q = {"question_id": qid(lid, n), "grade_level": grade, "lesson_id": lid, "topic_code": lid, "skill_code": lid, "question_type": qtype, "routine_level": rl, "difficulty": diff, "confidence_role": conf, "question_text_th": q_text, "choices": choices, "correct_answer": ca, "explanation_th": exp, "hint_th": hint, "solution_strategy_th": sol, "singapore_math_model": sg, "common_wrong_reason_th": "เปรียบเทียบตัวเลขผิด"}
    return q

def g4_decimals_intro(n, qtype, diff):
    grade = 4; lid = "g4_decimals_intro"
    conf = "build_confidence" if qtype == "core" else "stretch_thinking"
    rl = "routine" if qtype == "core" else "non_routine"
    a = round(random.uniform(0.5, 9.9), 1)
    b = round(random.uniform(0.5, 9.9), 1)
    big = max(a, b)
    correct = str(big)
    choices, ca = make_choices(correct, diff)
    q_text = f"จำนวนในข้อใดมากกว่า: {a} หรือ {b}?"
    hint = "เปรียบเทียบทศนิยม"
    sol = f"{big} > {min(a, b)}"
    exp = f"{big} มากกว่า {min(a, b)} ✅"
    sg = "number_line"
    q = {"question_id": qid(lid, n), "grade_level": grade, "lesson_id": lid, "topic_code": lid, "skill_code": lid, "question_type": qtype, "routine_level": rl, "difficulty": diff, "confidence_role": conf, "question_text_th": q_text, "choices": choices, "correct_answer": ca, "explanation_th": exp, "hint_th": hint, "solution_strategy_th": sol, "singapore_math_model": sg, "common_wrong_reason_th": "เปรียบเทียบทศนิยมผิด"}
    return q

def g4_fractions(n, qtype, diff):
    grade = 4; lid = "g4_fractions"
    conf = "build_confidence" if qtype == "core" else "stretch_thinking"
    rl = "routine" if qtype == "core" else "non_routine"
    d = random.choice([2,3,4,5,6])
    pairs = [(i,j) for i in range(1,d) for j in range(1,d) if i!=j and i/j == min(i,j)/max(i,j)]
    n1, n2 = random.sample(pairs, 2) if len(pairs) >= 2 else ((1,d), (2,d))
    correct = f"{n1[0]}/{n1[1]}"
    choices, ca = make_choices(correct, diff)
    q_text = f"เศษส่วนใดเท่ากับ {correct}?"
    hint = "หาคู่ที่มีค่าเท่ากัน"
    sol = f"{correct} = {n2[0]}/{n2[1]}"
    exp = f"{correct} เท่ากับ {n2[0]}/{n2[1]} ✅"
    sg = "fraction_strip"
    q = {"question_id": qid(lid, n), "grade_level": grade, "lesson_id": lid, "topic_code": lid, "skill_code": lid, "question_type": qtype, "routine_level": rl, "difficulty": diff, "confidence_role": conf, "question_text_th": q_text, "choices": choices, "correct_answer": ca, "explanation_th": exp, "hint_th": hint, "solution_strategy_th": sol, "singapore_math_model": sg, "common_wrong_reason_th": "ไม่เข้าใจเศษส่วนที่เท่ากัน"}
    return q

def g6_gcf_lcm(n, qtype, diff):
    grade = 6; lid = "g6_gcf_lcm"
    conf = "build_confidence" if qtype == "core" else "stretch_thinking"
    rl = "routine" if qtype == "core" else "non_routine"
    q_kind = random.choice(["gcf", "lcm"])
    if q_kind == "gcf":
        a = random.randint(2, 9) * random.randint(2, 5)
        b = random.randint(2, 9) * random.randint(2, 5)
        factors_a = [i for i in range(1, a+1) if a % i == 0]
        factors_b = [i for i in range(1, b+1) if b % i == 0]
        common = set(factors_a) & set(factors_b)
        correct = str(max(common)) if common else "1"
        q_text = f"ตัวหารร่วมมาก (GCF) ของ {a} และ {b} คือ?"
    else:
        multiples_a = set()
        for i in range(1, 20):
            multiples_a.add(a * i if 'a' in dir() else 0)
        a = random.randint(2, 6)
        b = random.randint(2, 6)
        correct = str(a * b)
        q_text = f"ตัวคูณร่วมน้อย (LCM) ของ {a} และ {b} คือ?"
    choices, ca = make_choices(correct, diff)
    hint = "หาตัวหารร่วมมาก" if q_kind == "gcf" else "หาตัวคูณร่วมน้อย"
    sol = f"คำตอบคือ {correct}"
    exp = f"{q_text} → คำตอบคือ {correct} ✅"
    sg = "none"
    q = {"question_id": qid(lid, n), "grade_level": grade, "lesson_id": lid, "topic_code": lid, "skill_code": lid, "question_type": qtype, "routine_level": rl, "difficulty": diff, "confidence_role": conf, "question_text_th": q_text, "choices": choices, "correct_answer": ca, "explanation_th": exp, "hint_th": hint, "solution_strategy_th": sol, "singapore_math_model": sg, "common_wrong_reason_th": "หา GCF/LCM ผิดวิธี"}
    return q

def gen_file(lesson_func, grade, lid):
    path = os.path.join(BASE, f"grade_{grade}", f"{lid}.jsonl")
    diffs_core = ["easy"]*16 + ["medium"]*12 + ["hard"]*4
    diffs_ch = ["medium"]*4 + ["hard"]*4
    random.shuffle(diffs_core)
    random.shuffle(diffs_ch)
    lines = []
    for i, d in enumerate(diffs_core):
        q = lesson_func(i+1, "core", d)
        lines.append(json.dumps(q, ensure_ascii=False))
    for i, d in enumerate(diffs_ch):
        q = lesson_func(33+i, "challenge", d)
        lines.append(json.dumps(q, ensure_ascii=False))
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    actual = len(open(path, encoding="utf-8").readlines())
    print(f"{lid}: {actual} lines")

if __name__ == "__main__":
    gen_file(g4_large_numbers, 4, "g4_large_numbers")
    gen_file(g4_decimals_intro, 4, "g4_decimals_intro")
    gen_file(g4_fractions, 4, "g4_fractions")
    gen_file(g6_gcf_lcm, 6, "g6_gcf_lcm")
    print("ALL DONE")