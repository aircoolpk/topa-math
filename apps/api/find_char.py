import json

# Find the actual byte position more precisely
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
with open(path, 'rb') as f:
    raw = f.read()

# The error says char 6663 (1-indexed in JSON error, which is 0-indexed in string)
# But JSON uses 1-indexed positions in the string
# char 6663 means the 6663rd character in the decoded string
# With BOM of 3 bytes, raw position would be 6663 + 3 = 6666

pos = 6663  # JSON error uses 1-indexed char position

# Decode the content to verify
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Get chars 6650-6700
with open(r'D:\web app\4-craft.com\apps\api\char_range.txt', 'w', encoding='utf-8') as out:
    out.write(f'Char at position {pos}:\n')
    out.write(f'Char: {repr(content[pos])}\n')
    out.write(f'Context: {repr(content[6650:6720])}\n')
    
    # Find the corresponding line
    lines = content.split('\n')
    char_count = 0
    for i, line in enumerate(lines):
        if char_count <= pos < char_count + len(line):
            out.write(f'Line {i+1}, column {pos - char_count + 1}\n')
            out.write(f'Line content: {repr(line)}\n')
            break
        char_count += len(line)