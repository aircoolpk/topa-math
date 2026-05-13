import json, os, sys, re, shutil
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'D:\web app\4-craft.com\apps\api\app\content\math'
BACKUP = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round1'
os.makedirs(BACKUP, exist_ok=True)

def extract_nums(text):
    """Extract all numbers from text."""
    return [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?', str(text))]

def math_validate(question, answer_str):
    """Returns True/False/None. None = uncertain pattern."""
    if not answer_str:
        return None
    try:
        qnums = extract_nums(question)
        ans_raw = re.sub(r'[^\d.]', '', str(answer_str))
        if not ans_raw:
            return None
        answer = float(ans_raw)
        
        q = question
        
        # multiplication: "X × Y = ?"
        if '×' in q or '*' in q or 'คูณ' in q:
            if len(qnums) >= 2:
                return abs(qnums[0] * qnums[1] - answer) < 0.001
        
        # division: "X ÷ Y = ?"
        if '÷' in q or ('/' in q and 'เปอร์เซ็นต์' not in q):
            if len(qnums) >= 2 and qnums[1] != 0:
                return abs(qnums[0] / qnums[1] - answer) < 0.001
        
        # money change: "ซื้อ X บาท จ่าย Y บาท ได้เงินทอน"
        if 'ทอน' in q:
            if len(qnums) >= 2:
                return abs(qnums[1] - qnums[0] - answer) < 0.001
        
        # addition: "X + Y", "X บวก Y", "รวม X กับ Y"
        if '+' in q or 'บวก' in q or 'รวม' in q:
            if len(qnums) >= 2:
                return abs(qnums[0] + qnums[1] - answer) < 0.001
        
        # subtraction: "X - Y", or question contains เหลือ/ใช้/ลบ
        if '-' in q and len(qnums) >= 2:
            return abs(qnums[0] - qnums[1] - answer) < 0.001
        if 'เหลือ' in q or 'ใช้' in q or 'ลบ' in q or 'หัก' in q:
            if len(qnums) >= 2:
                return abs(qnums[0] - qnums[1] - answer) < 0.001
        
        # multi-step: "X × Y = ? แล้วบวก Z"
        if 'แล้ว' in q:
            # find "X × Y"
            m = re.search(r'(\d+)\s*[××]\s*(\d+)', q)
            op_m = re.search(r'แล้ว\s*([+\-×÷])', q)
            if m and op_m:
                a, b = float(m.group(1)), float(m.group(2))
                op = op_m.group(1)
                c_match = re.search(r'แล้ว\s*[+\-×÷]\s*(\d+)', q)
                if c_match:
                    c = float(c_match.group(1))
                    if op == '+':
                        return abs(a * b + c - answer) < 0.001
                    elif op == '-':
                        return abs(a * b - c - answer) < 0.001
                    elif op == '×':
                        return abs(a * b * c - answer) < 0.001
        
        # place end-to-end: "ไม้บรรทัดยาว X ซม. วางเรียง Y อัน รวมกี่ ซม."
        if 'วางเรียง' in q and 'รวม' in q and len(qnums) >= 2:
            return abs(qnums[0] * qnums[1] - answer) < 0.001
        
        # ratio: "อัตราส่วน A:B ถ้าใช้ส่วนแรก X"
        if 'อัตราส่วน' in q and 'ส่วนที่สอง' in q:
            rm = re.search(r'(\d+)\s*:\s*(\d+)', q)
            if rm and len(qnums) >= 1:
                a, b = float(rm.group(1)), float(rm.group(2))
                x = qnums[0]
                if a != 0:
                    return abs(b * x / a - answer) < 0.001
        
        # cube volume: "ทรงลูกบาศก์ด้าน X"
        if 'ทรงลูกบาศก์' in q and 'ด้าน' in q and len(qnums) >= 1:
            return abs(qnums[0] ** 3 - answer) < 0.001
        
        # simple equation: "x + A = B"
        eq = re.search(r'x\s*\+\s*(\d+)\s*=\s*(\d+)', q)
        if eq:
            a, b = float(eq.group(1)), float(eq.group(2))
            return abs(b - a - answer) < 0.001
        
        # fraction to percent: "1/4 เขียนเป็นเปอร์เซ็นต์"
        if ('เปอร์เซ็นต์' in q or '%' in str(answer_str)) and '/' in q:
            fm = re.search(r'(\d+)\s*/\s*(\d+)', q)
            if fm and '%' in str(answer_str):
                num, den = float(fm.group(1)), float(fm.group(2))
                if den != 0:
                    return abs(num / den * 100 - answer) < 0.001
        
    except:
        pass
    return None

# Content bugs: answer value is wrong - fix these
# Map: (lesson_id, variant, question_pattern) -> correct_answer
CONTENT_BUG_FIXES = {
    # g1_add_within_20: question "5 + N = ?" → answer stored as first num, should be sum
    ('g1_add_within_20', 'v01'): '9',   # 5+4=9
    ('g1_add_within_20', 'v02'): '10',  # 5+5=10
    ('g1_add_within_20', 'v03'): '11',  # 5+6=11
    ('g1_add_within_20', 'v04'): '12',  # 5+7=12
    ('g1_add_within_20', 'v05'): '13',  # 5+8=13
    ('g1_add_within_20', 'v06'): '14',  # 5+9=14
    ('g1_add_within_20', 'v07'): '15',  # 5+10=15
    ('g1_add_within_20', 'v08'): '16',  # 5+11=16
    ('g1_add_within_20', 'v09'): '17',  # 5+12=17
    ('g1_add_within_20', 'v10'): '18',  # 5+13=18
    ('g1_add_within_20', 'ep_v01'): '9',  # 5+4=9
    
    # g1_subtract_within_20: question "N - 4 = ?" → answer stored as N, should be N-4
    ('g1_subtract_within_20', 'v01'): '9',   # 13-4=9
    ('g1_subtract_within_20', 'v02'): '10',  # 14-4=10
    ('g1_subtract_within_20', 'v03'): '11',  # 15-4=11
    ('g1_subtract_within_20', 'v04'): '12',  # 16-4=12
    ('g1_subtract_within_20', 'v05'): '13',  # 17-4=13
    ('g1_subtract_within_20', 'v06'): '14',  # 18-4=14
    ('g1_subtract_within_20', 'v07'): '15',  # 19-4=15
    ('g1_subtract_within_20', 'v08'): '16',  # 20-4=16
    ('g1_subtract_within_20', 'v09'): '17',  # 21-4=17
    ('g1_subtract_within_20', 'v10'): '18',  # 22-4=18
    ('g1_subtract_within_20', 'ep_v01'): '9',  # 13-4=9
    
    # g3_measurement: "ไม้บรรทัดยาว 9 ซม. วางเรียง 2 อัน" = 18
    ('g3_measurement', 'v01'): '18 ซม.',
    ('g3_measurement', 'v02'): '18 ซม.',
    ('g3_measurement', 'v03'): '18 ซม.',
    ('g3_measurement', 'v04'): '18 ซม.',
    ('g3_measurement', 'v05'): '18 ซม.',
    ('g3_measurement', 'v06'): '18 ซม.',
    ('g3_measurement', 'v07'): '18 ซม.',
    ('g3_measurement', 'v08'): '18 ซม.',
    ('g3_measurement', 'v09'): '18 ซม.',
    ('g3_measurement', 'v10'): '18 ซม.',
    ('g3_measurement', 'ep_v01'): '18 ซม.',
    
    # g3_multi_step_word_problems: "3 × 4 = ? แล้วบวก 5" = 17
    ('g3_multi_step_word_problems', 'v01'): '17 ลูก',
    ('g3_multi_step_word_problems', 'v02'): '17 ลูก',
    ('g3_multi_step_word_problems', 'v03'): '17 ลูก',
    ('g3_multi_step_word_problems', 'v04'): '17 ลูก',
    ('g3_multi_step_word_problems', 'v05'): '17 ลูก',
    ('g3_multi_step_word_problems', 'v06'): '17 ลูก',
    ('g3_multi_step_word_problems', 'v07'): '17 ลูก',
    ('g3_multi_step_word_problems', 'v08'): '17 ลูก',
    ('g3_multi_step_word_problems', 'v09'): '17 ลูก',
    ('g3_multi_step_word_problems', 'v10'): '17 ลูก',
    ('g3_multi_step_word_problems', 'ep_v01'): '17 ลูก',
    
    # g6_equations_intro: x+8=15 → x=7
    ('g6_equations_intro', 'v01'): 'x = 7',
    ('g6_equations_intro', 'v02'): 'x = 7',
    ('g6_equations_intro', 'v03'): 'x = 7',
    ('g6_equations_intro', 'v04'): 'x = 7',
    ('g6_equations_intro', 'v05'): 'x = 7',
    ('g6_equations_intro', 'v06'): 'x = 7',
    ('g6_equations_intro', 'v07'): 'x = 7',
    ('g6_equations_intro', 'v08'): 'x = 7',
    ('g6_equations_intro', 'v09'): 'x = 7',
    ('g6_equations_intro', 'v10'): 'x = 7',
    ('g6_equations_intro', 'ep_v01'): 'x = 7',
    
    # g6_fraction_decimal_percent: 1/4 = 25%
    ('g6_fraction_decimal_percent', 'v01'): '25%',
    ('g6_fraction_decimal_percent', 'v02'): '25%',
    ('g6_fraction_decimal_percent', 'v03'): '25%',
    ('g6_fraction_decimal_percent', 'v04'): '25%',
    ('g6_fraction_decimal_percent', 'v05'): '25%',
    ('g6_fraction_decimal_percent', 'v06'): '25%',
    ('g6_fraction_decimal_percent', 'v07'): '25%',
    ('g6_fraction_decimal_percent', 'v08'): '25%',
    ('g6_fraction_decimal_percent', 'v09'): '25%',
    ('g6_fraction_decimal_percent', 'v10'): '25%',
    ('g6_fraction_decimal_percent', 'ep_v01'): '25%',
    
    # g6_ratio_proportion: 2:5 with first=4 → second=10
    ('g6_ratio_proportion', 'v01'): '10',
    ('g6_ratio_proportion', 'v02'): '10',
    ('g6_ratio_proportion', 'v03'): '10',
    ('g6_ratio_proportion', 'v04'): '10',
    ('g6_ratio_proportion', 'v05'): '10',
    ('g6_ratio_proportion', 'v06'): '10',
    ('g6_ratio_proportion', 'v07'): '10',
    ('g6_ratio_proportion', 'v08'): '10',
    ('g6_ratio_proportion', 'v09'): '10',
    ('g6_ratio_proportion', 'v10'): '10',
    ('g6_ratio_proportion', 'ep_v01'): '10',
    
    # g2_multiplication_intro ep_v01: 3×4=12
    ('g2_multiplication_intro', 'ep_v01'): '12',
    # g2_times_table_2_5_10 ep_v01: 7×2=14
    ('g2_times_table_2_5_10', 'ep_v01'): '14',
    # g2_money_change ep_v01: ซื้อ25 จ่าย50 ทอน25 ✓ (already correct!)
}

stats = {'fixed_ca': 0, 'fixed_ans': 0, 'fixed_exp': 0, 'math_false': 0, 'files_changed': set()}
content_bugs = []

for grade in range(1, 7):
    grade_dir = os.path.join(BASE, f'grade_{grade}', 'lessons')
    if not os.path.isdir(grade_dir):
        continue
    for fn in os.listdir(grade_dir):
        if not fn.endswith('.json'):
            continue
        fp = os.path.join(grade_dir, fn)
        with open(fp, 'rb') as f:
            obj = json.load(f)
        
        changed = False
        lesson_id = obj.get('lesson_id', fn)
        
        for variant in obj.get('lesson_variants', []):
            vid = variant.get('variant_id')
            for block in variant.get('visual_blocks', []):
                if block.get('type') != 'mini_quiz':
                    continue
                
                mq = block
                data = mq.get('data', {})
                
                # Schema B: data.questions array
                if 'questions' in data:
                    for q in data.get('questions', []):
                        has_ca = 'correct_answer' in q and str(q.get('correct_answer', '')).strip() != ''
                        has_ans = 'answer' in q and str(q.get('answer', '')).strip() != ''
                        if not has_ca and has_ans:
                            q['correct_answer'] = q['answer']
                            stats['fixed_ca'] += 1
                            changed = True
                    continue
                
                # Schema C: content.questions (options_th/answer_th)
                if 'content' in block and isinstance(block.get('content'), dict):
                    content_questions = block['content'].get('questions', [])
                    for q in content_questions:
                        has_ca = 'correct_answer' in q and str(q.get('correct_answer', '')).strip() != ''
                        has_ans = ('answer_th' in q or 'answer' in q) and str(q.get('answer_th') or q.get('answer', '')).strip() != ''
                        if not has_ca and has_ans:
                            ans_val = q.get('answer_th') or q.get('answer', '')
                            q['correct_answer'] = ans_val
                            stats['fixed_ca'] += 1
                            changed = True
                    continue
                
                # Schema A: single question
                has_ca = 'correct_answer' in mq and str(mq.get('correct_answer', '')).strip() != ''
                has_ans = 'answer' in mq and str(mq.get('answer', '')).strip() != ''
                
                if not has_ca and has_ans:
                    answer_val = mq['answer']
                    question_text = mq.get('question', '') or mq.get('question_th', '') or ''
                    math_ok = math_validate(question_text, answer_val)
                    
                    if math_ok is True:
                        mq['correct_answer'] = answer_val
                        stats['fixed_ca'] += 1
                        changed = True
                    elif math_ok is False:
                        # Check if we have a known content bug fix
                        fix_key = (lesson_id, vid)
                        if fix_key in CONTENT_BUG_FIXES:
                            correct = CONTENT_BUG_FIXES[fix_key]
                            mq['answer'] = correct
                            mq['correct_answer'] = correct
                            mq['explanation_th'] = 'คำนวณตามโจทย์แล้วได้คำตอบที่ถูกต้อง'
                            stats['fixed_ans'] += 1
                            stats['fixed_ca'] += 1
                            changed = True
                        else:
                            content_bugs.append({
                                'lesson': lesson_id,
                                'variant': vid,
                                'wrong_answer': answer_val,
                                'question': question_text[:80]
                            })
                            stats['math_false'] += 1
                    else:
                        # uncertain - add anyway
                        mq['correct_answer'] = answer_val
                        stats['fixed_ca'] += 1
                        changed = True
                
                # Ensure explanation_th exists
                if not mq.get('explanation_th'):
                    exp = mq.get('explanation') or ''
                    mq['explanation_th'] = exp if exp else 'คำนวณตามโจทย์แล้วได้คำตอบที่ถูกต้อง'
                    stats['fixed_exp'] += 1
                    changed = True
        
        if changed:
            stats['files_changed'].add(fn)
            shutil.copy2(fp, os.path.join(BACKUP, fn))
            with open(fp, 'w', encoding='utf-8') as f:
                json.dump(obj, f, ensure_ascii=False, indent=2)

print('Stats:', stats)
print(f'Files changed: {len(stats["files_changed"])}')
print(f'Content bugs remaining (unresolved): {len(content_bugs)}')
for b in content_bugs[:10]:
    print(f"  {b['lesson']} {b['variant']}: wrong={b['wrong_answer']} | {b['question'][:50]}")