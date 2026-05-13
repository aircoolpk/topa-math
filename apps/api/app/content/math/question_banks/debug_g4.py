#!/usr/bin/env python3
import pathlib

path = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\grade_4\g4_angles_geometry.jsonl')
with open(path, 'rb') as f:
    raw = f.read()

# Find }{ pattern which would indicate two separate JSON objects
for i in range(800, min(850, len(raw)-1)):
    if raw[i] == 0x7D and raw[i+1] == 0x7B:  # }{
        print('Found }} at positions {} {}'.format(i, i+1))
        print('Before: {}'.format(repr(raw[max(0,i-10):i+1])))
        print('After: {}'.format(repr(raw[i+1:i+22])))
        break
else:
    print('No }{ found in range')

# Show raw bytes around position 809
print('\nRaw bytes 805-820:')
for j in range(805, min(821, len(raw))):
    print('  byte {}: {} ({})'.format(j, hex(raw[j]), raw[j]))

# Check if there's a newline (0x0A = \n)
for j in range(805, min(821, len(raw))):
    if raw[j] == 0x0A:
        print('Newline at byte', j)