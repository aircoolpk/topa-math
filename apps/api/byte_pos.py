import json

with open(r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons\g2_add_two_digit.json', 'rb') as f:
    raw = f.read()

# Find UTF-8 BOM
bom_len = 3 if raw[:3] == b'\xef\xbb\xbf' else 0

# char 6652 -> raw position
raw_pos = 6652 + bom_len  # = 6655

# Show bytes around 6655
start = max(0, raw_pos - 20)
end = min(len(raw), raw_pos + 60)
section = raw[start:end]

print(f'Raw position {raw_pos} (0x{raw_pos:X}):')
print(f'Hex: {section.hex()}')
print()
print('Character positions in this section:')
for i, b in enumerate(section):
    char_pos = start + i - bom_len
    print(f'  raw {start+i:4X} (char {char_pos:4d}): 0x{b:02X} = {chr(b) if 32<=b<127 else "?"}')