#!/usr/bin/env python3
import pathlib

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py')
src = path.read_text(encoding='utf-8')
lines = src.split('\n')

# Count def gen_g2_time_calendar
count_tc = src.count('def gen_g2_time_calendar')
count_shapes = src.count('def gen_g2_shapes_2d')
print('def gen_g2_time_calendar count:', count_tc)
print('def gen_g2_shapes_2d count:', count_shapes)

# Find all occurrences with context
print('\nOccurrences of def gen_g2_time_calendar:')
idx = 0
while True:
    idx = src.find('def gen_g2_time_calendar', idx)
    if idx < 0:
        break
    line_no = src[:idx].count('\n') + 1
    print('  char {}, line {}'.format(idx, line_no))
    idx += 1

# Show lines around 688
print('\nLine 688: {}'.format(repr(lines[687][:80])))
print('Line 689: {}'.format(repr(lines[688][:80])))
print('Line 690: {}'.format(repr(lines[689][:80])))
print('Line 691: {}'.format(repr(lines[690][:80])))
print('Line 692: {}'.format(repr(lines[691][:80])))
print('Line 693: {}'.format(repr(lines[692][:80])))
print('Line 694: {}'.format(repr(lines[693][:80])))

# Check what function definitions come BEFORE line 688
print('\nFunctions defined before line 688:')
for i in range(0, 687):
    line = lines[i]
    if line.strip().startswith('def gen_'):
        print('  line {}: {}'.format(i+1, line.strip()[:60]))