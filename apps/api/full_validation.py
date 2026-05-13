import json

path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'

# Read with utf-8-sig (handles BOM)
with open(path, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

print(f'Total lines: {len(lines)}')

# Check line 251 (index 250)
print(f'Line 251 (index 250):')
print(f'  Content: {repr(lines[250])}')
print(f'  Length: {len(lines[250])}')

# Check the actual character at column 59 in line 251 (0-indexed column 58)
col_58 = lines[250][58] if len(lines[250]) > 58 else 'MISSING'
print(f'  Column 59 (index 58): {repr(col_58)} (ord: {ord(col_58) if isinstance(col_58, str) else "N/A"})')

# Now verify by parsing
with open(path, 'r', encoding='utf-8-sig') as f:
    try:
        json.load(f)
        print('\nJSON is VALID')
    except json.JSONDecodeError as e:
        print(f'\nJSON INVALID at line {e.lineno}, column {e.colno}, char {e.pos}')
        print(f'Error: {e.msg}')
        
        # Show context around the error position
        with open(path, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        
        err_pos = e.pos
        start = max(0, err_pos - 50)
        end = min(len(content), err_pos + 50)
        print(f'\nContext around error (chars {start}-{end}):')
        print(repr(content[start:end]))