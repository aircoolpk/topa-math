import json

# Check what line 241 looks like in g2_add_two_digit.json
with open(r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json', 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

print('Line 241:')
print(repr(lines[240]))
print()
print('Line 240:')
print(repr(lines[239]))
print()
print('Line 242:')
print(repr(lines[241]))
print()
print('Line 243:')
print(repr(lines[242]))