import json

fpath = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(fpath, 'r', encoding='utf-8-sig') as f:
    data = json.load(f)

with open(r'D:\web app\4-craft.com\apps\api\q_explanations.txt', 'w', encoding='utf-8') as out:
    for i, q in enumerate(data.get('questions', [])[:10]):
        exp = q.get('explanation_th', 'NO EXPLANATION')
        correct = q.get('correct_answer', 'MISSING')
        text = q.get('question_th', '')[:50]
        choices = q.get('choices', [])
        out.write('Q%d:\n' % (i+1))
        out.write('  text: %s\n' % repr(text))
        out.write('  choices: %s\n' % repr(choices[:4]))
        out.write('  correct_answer: %s\n' % repr(correct))
        out.write('  explanation_th: %s\n' % repr(exp[:80]))
        out.write('\n')