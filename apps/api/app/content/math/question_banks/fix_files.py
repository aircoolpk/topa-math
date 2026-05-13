#!/usr/bin/env python3
import pathlib, json

# Fix and verify the files
base = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')

fixed = []
errors = []

for g in [1,2,3,4,5,6]:
    d = base / 'grade_{}'.format(g)
    if not d.exists():
        continue
    for f in sorted(d.glob('*.jsonl')):
        try:
            with open(f, 'r', encoding='utf-8-sig') as fp:
                content = fp.read()
            lines = content.split('\n')
            valid_lines = []
            for line in lines:
                line = line.strip()
                if line:
                    try:
                        json.loads(line)
                        valid_lines.append(line)
                    except:
                        pass  # skip bad lines
            # Check for BOM and remove
            with open(f, 'w', encoding='utf-8') as fp:
                fp.write('\n'.join(valid_lines))
            fixed.append('Fixed: {} ({} lines)'.format(f.name, len(valid_lines)))
        except Exception as e:
            errors.append('Error {}: {}'.format(f.name, e))

for msg in fixed[:20]:
    print(msg)
print('...')
for msg in errors:
    print(msg)