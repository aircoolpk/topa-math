import json

# Read raw bytes and show the structure around char 6652
with open(r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json', 'rb') as f:
    raw = f.read()

# Find the UTF-8 BOM (EF BB BF) and skip it
bom_len = 0
if raw[:3] == b'\xef\xbb\xbf':
    bom_len = 3

# Decode the relevant section
start = max(0, 6640 - bom_len)
end = min(len(raw), 6680 - bom_len)
section = raw[start:end]

print(f'Analyzing bytes {start}-{end} (raw file positions):')
print(f'BOM: {bom_len} bytes')
print()
print('Hex dump:')
for i in range(0, len(section), 16):
    chunk = section[i:i+16]
    hex_str = ' '.join(f'{b:02X}' for b in chunk)
    ascii_str = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
    print(f'{start+i:04X}: {hex_str:<48} {ascii_str}')
print()

# Decode as UTF-8
text = section.decode('utf-8')
print(f'Text (escaped):')
print(text.encode('unicode-escape').decode('ascii'))