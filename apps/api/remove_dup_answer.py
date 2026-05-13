import json, os

base_dir = r'D:\web app\4-craft.com\apps\api\app\content\math'

removed_count = 0
files_fixed = []
errors = []

for root, dirs, files in os.walk(base_dir):
    for fname in files:
        if not fname.endswith('.json'):
            continue
        fpath = os.path.join(root, fname)
        
        try:
            with open(fpath, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
        except:
            continue
        
        # Skip if not a lesson file
        if not isinstance(data, dict) or 'questions' not in data:
            continue
        
        local_removed = 0
        questions = data['questions']
        
        if not isinstance(questions, list):
            continue
        
        for q in questions:
            if isinstance(q, dict) and 'answer' in q and 'correct_answer' in q:
                # Both exist - remove 'answer' field
                del q['answer']
                local_removed += 1
        
        if local_removed > 0:
            try:
                # Write with json.dumps then convert to CRLF and add BOM
                json_str = json.dumps(data, ensure_ascii=False, indent=2)
                # Convert LF to CRLF
                json_str = json_str.replace('\n', '\r\n')
                # Add BOM (UTF-8 BOM is EF BB BF)
                bom_bytes = b'\xef\xbb\xbf' + json_str.encode('utf-8')
                
                with open(fpath, 'wb') as f:
                    f.write(bom_bytes)
                
                files_fixed.append((fname, local_removed))
                removed_count += local_removed
            except Exception as e:
                errors.append((fname, str(e)[:100]))

with open(r'D:\web app\4-craft.com\apps\api\remove_result.txt', 'w', encoding='utf-8') as f:
    f.write('Total answer fields removed: %d\n' % removed_count)
    f.write('Files fixed: %d\n' % len(files_fixed))
    for fname, count in files_fixed:
        f.write('  %s: %d\n' % (fname, count))
    if errors:
        f.write('\nErrors:\n')
        for fname, err in errors:
            f.write('  %s: %s\n' % (fname, err))

print('Done. Removed:', removed_count, 'from', len(files_fixed), 'files')
if errors:
    print('Errors:', len(errors))