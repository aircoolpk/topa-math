import json, os, random

BASE = r"D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_2"
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

    if lid == "g2_add_two_digit":
        a = random.randint(10,99); b = random.randint(10,99)
        c = str(a+b); q_text = f"{a} + {b} = ?"
        h = "บวกเลขทีละหลัก"; s = f"{a}+{b}={c}"; e = f"{a}+{b}={c} ✅"; sg = "place_value_chart"

    elif lid == "g2_subtract_two_digit":
        a = random.randint(30,99); b = random.randint(10,a-1)
        c = str(a-b); q_text = f"{a} - {b} = ?"
        h = "ลบเลขทีละหลัก"; s = f"{a}-{b}={c}"; e = f"{a}-{b}={c} ✅"; sg = "place_value_chart"

    elif lid == "g2_multiplication_intro":
        a = random.randint(2,5); b = random.randint(2,9)
        c = str(a*b); q_text = f"{a} x {b} = ?"
        h = "คูณเลข"; s = f"{a}x{b}={c}"; e = f"{a}x{b}={c} ✅"; sg = "array"

    elif lid == "g2_times_table_2_5_10":
        t = random.choice([2,5,10]); b = random.randint(1,10); c = str(t*b)
        q_text = f"สูตรคูณแม่ {t}: {t} x {b} = ?"
        h = f"สูตรคูณแม่ {t}"; s = f"{t}x{b}={c}"; e = f"{t}x{b}={c} ✅"; sg = "array"

    elif lid == "g2_money_change":
        price = random.randint(5,95); paid = random.choice([10,20,50,100])
        change = paid - price
        q_text = f"ซื้อของราคา {price} บาท จ่าย {paid} บาท ได้รับเงินทอนกี่บาท?"
        c = str(change); h = "ลบหาส่วนต่าง"; s = f"{paid}-{price}={change}"; e = f"{paid}-{price}={change} บาท ✅"; sg = "none"

    elif lid == "g2_time_calendar":
        hour = random.randint(1,12); q_text = f"นาฬิกาบอกเวลากี่โมงถ้าเข็มสั้นชี้ที่ {hour}?"
        c = str(hour); h = "เข็มสั้นบอกชั่วโมง"; s = f"เข็มสั้นชี้ที่ {hour} = {hour} โมง"; e = f"{hour} โมง ✅"; sg = "none"

    elif lid == "g2_shapes_2d":
        shapes = [("สี่เหลี่ยม",4),("สามเหลี่ยม",3),("วงกลม",0),("สี่เหลี่ยมผืนผ้า",4)]
        name,corners = random.choice(shapes)
        q_text = f"รูป{name}มีกี่มุม?"
        c = str(corners); h = "นับจำนวนมุม"; s = f"{name}มี{corners}มุม"; e = f"{name}มี{corners}มุม ✅"; sg = "none"

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
        lines.append(json.dumps(make_q(2,lid,i+1,"core",d), ensure_ascii=False))
    for i,d in enumerate(diffs_ch):
        lines.append(json.dumps(make_q(2,lid,33+i,"challenge",d), ensure_ascii=False))
    with open(path,"w",encoding="utf-8") as f:
        f.write("\n".join(lines)+"\n")
    count = len(open(path,encoding="utf-8").readlines())
    print(f"{lid}: {count} lines")

for lid in ["g2_add_two_digit","g2_subtract_two_digit","g2_multiplication_intro","g2_times_table_2_5_10","g2_money_change","g2_time_calendar","g2_shapes_2d"]:
    gen_file(lid)
print("DONE")
