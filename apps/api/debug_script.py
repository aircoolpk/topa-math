import re

path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(path, 'r', encoding='utf-8-sig') as fp:
    content = fp.read()

idx = content.find('See correct answer above')
search_start = idx - 5000
chunk = content[search_start:idx+100]
mini_pos = chunk.rfind('"type"')
print('mini_quiz type found at offset', search_start + mini_pos)

with open(r'D:\web app\4-craft.com\apps\api\debug_output.txt', 'w', encoding='utf-8') as f:
    f.write('mini_quiz type found at offset ' + str(search_start + mini_pos) + '\n\n')
    f.write('Chunk around mini_quiz type:\n')
    f.write(repr(chunk[mini_pos:mini_pos+500]))
    f.write('\n\n')
    f.write('Questions block:\n')
    # Find the questions array
    q_pos = chunk.rfind('"questions"')
    f.write(repr(chunk[q_pos:q_pos+400]))
