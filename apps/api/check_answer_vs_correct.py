import json

fpath = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(fpath, 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

with open(r'D:\web app\4-craft.com\apps\api\answer_vs_correct.txt', 'w', encoding='utf-8') as out:
    for i, q in enumerate(data.get('questions', [])[:10]):
        answer = q.get('answer', 'MISSING')
        correct = q.get('correct_answer', 'MISSING')
        same = answer == correct
        out.write('Q%d: answer=%s correct=%s same=%s\n' % (i+1, repr(answer), repr(correct), same))