import json

# Validate and show full error context
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json'
try:
    with open(path, 'r', encoding='utf-8-sig') as f:
        json.load(f)
    print('VALID JSON')
except json.JSONDecodeError as e:
    print(f'Error: {e.msg}')
    print(f'Line {e.lineno}, Col {e.colno}, Char {e.pos}')
    
    with open(path, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
    
    # Show the problematic area
    err_line = e.lineno - 1
    start = max(0, err_line - 2)
    end = min(len(lines), err_line + 3)
    
    with open(r'D:\web app\4-craft.com\apps\api\json_error.txt', 'w', encoding='utf-8') as out:
        out.write(f'Error at line {e.lineno}, col {e.colno}, char {e.pos}\n\n')
        for i in range(start, end):
            marker = '>>> ' if i == err_line else '    '
            out.write(f'{marker}Line {i+1}: {repr(lines[i])}\n')
        
        # Also show the raw bytes around the error position
        with open(path, 'rb') as f:
            raw = f.read()
        
        # Find the actual byte position
        bom_len = 3 if raw[:3] == b'\xef\xbb\xbf' else 0
        pos = e.pos + bom_len
        
        out.write(f'\nRaw bytes around error (pos {pos}):\n')
        start = max(0, pos - 30)
        end = min(len(raw), pos + 50)
        out.write(f'Bytes {start}-{end}:\n')
        out.write(raw[start:end].hex())
        out.write('\n\nAs string (escaped):\n')
        out.write(raw[start:end].decode('utf-8', errors='replace'))