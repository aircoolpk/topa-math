import json, os, sys, re, shutil
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'D:\web app\4-craft.com\apps\api\app\content\math'

def math_validate(question, answer_str):
    """Check if answer is mathematically correct. Returns True/False/None (None=uncertain)."""
    if not answer_str:
        return None
    try:
        # Extract all numbers from question
        qnums = [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?', str(question))]
        # Extract number from answer (strip Thai units)
        ans_raw = re.sub(r'[^\d.]', '', str(answer_str))
        if not ans_raw:
            return None
        answer = float(ans_raw)
        
        # multiplication
        if '×' in question or '*' in question or 'คูณ' in question:
            if len(qnums) >= 2:
                return abs(qnums[0] * qnums[1] - answer) < 0.001
        
        # division
        if '÷' in question or '/' in question:
            if len(qnums) >= 2 and qnums[1] != 0:
                return abs(qnums[0] / qnums[1] - answer) < 0.001
        
        # money change (subtract)
        if 'ทอน' in question or 'จ่าย' in question:
            if len(qnums) >= 2:
                return abs(qnums[1] - qnums[0] - answer) < 0.001
        
        # addition (รวม, บวก, เพิ่ม, รวมกัน)
        if '+' in question or 'บวก' in question or 'รวม' in question or 'เพิ่ม' in question:
            if len(qnums) >= 2:
                return abs(qnums[0] + qnums[1] - answer) < 0.001
        
        # subtraction - use all subtract keywords
        if 'เหลือ' in question or 'ใช้' in question or 'ลบ' in question or 'หัก' in question:
            if len(qnums) >= 2:
                return abs(qnums[0] - qnums[1] - answer) < 0.001
        
        # simple subtraction (just minus sign)
        if '-' in question and len(qnums) >= 2:
            return abs(qnums[0] - qnums[1] - answer) < 0.001
        
        # multi-step: check for patterns like "X × Y = ? แล้วบวก Z = ?"
        # or "X + Y แล้วคูณ Z"
        if 'แล้ว' in question:
            # Try to parse "X × Y = ? แล้วบวก Z"
            mult_match = re.search(r'(\d+)\s*[××]\s*(\d+)\s*[=?:]*\s*แล้ว\s*[+-×÷]',
                                   question.replace('×', '×').replace('x', '×'))
            if not mult_match:
                mult_match = re.search(r'(\d+)\s*[×]\s*(\d+)', question)
            add_match = re.search(r'แล้ว\s*[+-×÷]\s*(\d+)', question)
            if mult_match and add_match:
                a, b = float(mult_match.group(1)), float(mult_match.group(2))
                c = float(add_match.group(1))
                if 'บวก' in question or 'ลบ' in question.split('แล้ว')[1][:5]:
                    # check which operator
                    after_then = question.split('แล้ว')[1][:10]
                    if 'บวก' in after_then or '+' in after_then:
                        return abs(a * b + c - answer) < 0.001
        
        # area/perimeter multi-step
        # "ไม้บรรทัดยาว X ซม. วางเรียง Y อัน รวมกี่ ซม." = X * Y
        if 'วางเรียง' in question and 'รวม' in question:
            if len(qnums) >= 2:
                return abs(qnums[0] * qnums[1] - answer) < 0.001
        
        # หรม. (GCF) / ครน. (LCM) - skip (too complex)
        
        # ratio: "อัตราส่วน A:B ถ้าใช้ส่วนแรก X ต้องใช้ส่วนที่สองเท่าไร"
        if 'อัตราส่วน' in question and 'ส่วนที่สอง' in question:
            ratio_match = re.search(r'(\d+)\s*:\s*(\d+)', question)
            if ratio_match and len(qnums) >= 1:
                a, b = float(ratio_match.group(1)), float(ratio_match.group(2))
                x = qnums[0]
                if b != 0:
                    return abs(b * x / a - answer) < 0.001
        
        # volume cube: side^3
        if 'ทรงลูกบาศก์' in question and 'ด้าน' in question:
            if len(qnums) >= 1:
                return abs(qnums[0] ** 3 - answer) < 0.001
        
        # equation: "x + A = B" → x = B - A
        if re.search(r'x\s*[\+\-]', question):
            eq_match = re.search(r'x\s*[\+\-]\s*(\d+)\s*=\s*(\d+)', question)
            if eq_match:
                a = float(eq_match.group(1))
                b = float(eq_match.group(2))
                if '+' in question.split('=')[0]:
                    return abs(b - a - answer) < 0.001
        
        # fraction to percent: 1/4 → 25%
        if 'เปอร์เซ็นต์' in question or '%' in question:
            frac_match = re.search(r'(\d+)\s*/\s*(\d+)', question)
            if frac_match and '%' in str(answer_str):
                num, den = float(frac_match.group(1)), float(frac_match.group(2))
                if den != 0:
                    return abs(num / den * 100 - answer) < 0.001
        
    except Exception as e:
        pass
    return None  # can't determine

# Re-check unresolved items
unresolved_cases = [
    ('g2_money_change', 'ep_v01', '25', 'ซื้อของ 25 บาท จ่าย 50 บาท ได้เงินทอนกี่บาท?'),
    ('g2_multiplication_intro', 'ep_v01', '3', '3 × 4 = ?'),
    ('g2_times_table_2_5_10', 'ep_v01', '7', '7 × 2 = ?'),
    ('g3_measurement', 'v01', '18 ซม.', '📏 ไม้บรรทัดยาว 9 ซม. วางเรียง 2 อัน รวมกี่ ซม.?'),
    ('g3_multi_step_word_problems', 'v01', '17 ลูก', '🎈 3 ลูก × 4 กล่อง = ? แล้วบวก 5 ลูก = ?'),
    ('g6_equations_intro', 'v01', 'x = 7', 'x + 8 = 15 หาค่า x'),
    ('g6_fraction_decimal_percent', 'v01', '25%', '1/4 เขียนเป็นเปอร์เซ็นต์ได้เท่าไหร่?'),
    ('g6_ratio_proportion', 'v01', '10', 'อัตราส่วน 2:5 ถ้าใช้ส่วนแรก 4 ต้องใช้ส่วนที่สองเท่าไหร่?'),
]

print('Re-checking unresolved cases:')
for lesson, variant, answer, question in unresolved_cases:
    result = math_validate(question, answer)
    print(f'  {lesson} {variant}: answer={answer} q={question[:40]} → {result}')

print()
print('Cases confirmed mathematically correct (True):')
for lesson, variant, answer, question in unresolved_cases:
    result = math_validate(question, answer)
    if result is True:
        print(f'  {lesson} {variant}: {answer} ✓')