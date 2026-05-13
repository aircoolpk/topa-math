import json

with open(r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json', 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

line = lines[250]  # line 251
# Analyze the spaces between the Thai explanation and }
# Find the position of the closing "
thai_end = line.find('"                                                      }')
print(f'Thai explanation ends at position: {thai_end}')
print(f'Line length: {len(line)}')
print(f'Spaces after closing quote: {len(line) - thai_end - len("                                                      }")}')

# Show bytes around the transition
with open(r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json', 'rb') as f:
    content_bytes = f.read()

# Find the actual bytes at position 6640-6720
with open(r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json', 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find the line 251 start position
line_251_start = sum(len(l) for l in lines[:250])
print(f'\nLine 251 starts at char: {line_251_start}')
print(f'Char 6652 (0-indexed) is at line position: 6652 - {line_251_start} = {6652 - line_251_start}')

# Get the bytes around char 6652
start = max(0, 6652 - 10)
end = min(len(content), 6652 + 50)
print(f'\nBytes around char 6652 (positions {start}-{end}):')
print(content[start:end].encode('unicode-escape').decode('ascii'))