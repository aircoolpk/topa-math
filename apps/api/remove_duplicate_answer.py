import json, os, re

base_dir = r'D:\web app\4-craft.com\apps\api\app\content\math'

# Remove duplicate "answer" field (keep only correct_answer)
# Pattern: match "answer": "value" that appears after choices array

removed_count = 0
files_fixed = []

for root, dirs, files in os.walk(base_dir):
    for fname in files:
        if not fname.endswith('.json'):
            continue
        fpath = os.path.join(root, fname)
        
        try:
            with open(fpath, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            json.loads(content)  # Verify valid JSON
        except:
            continue
        
        # Skip if not a lesson file (has lesson_id)
        if '"lesson_id"' not in content:
            continue
        
        # Find all "answer": patterns that appear after "choices":]
        # We need to remove just the "answer" key-value pair, not "correct_answer"
        
        # Strategy: for each "choices":[...], find the following "answer": and remove it
        # But we must be careful not to remove "correct_answer"
        
        new_content = content
        local_removed = 0
        
        # Find all positions of "choices":[
        choice_starts = [m.start() for m in re.finditer(r'"choices":\s*\[', content)]
        
        for cs in choice_starts:
            # Find the closing ] of this choices array
            depth = 0
            i = content.find('[', cs)
            if i == -1:
                continue
            start_bracket = i
            while i < len(content):
                if content[i] == '[':
                    depth += 1
                elif content[i] == ']':
                    depth -= 1
                    if depth == 0:
                        end_bracket = i
                        break
                i += 1
            else:
                continue
            
            # Now look for "answer": after the ] (within ~100 chars)
            search_start = end_bracket + 1
            search_end = min(end_bracket + 150, len(content))
            after_choices = content[search_start:search_end]
            
            # Check if there's an "answer": pattern (not "correct_answer":)
            # Pattern: "answer": "value" or "answer": "value",
            answer_match = re.search(r'"answer":\s*"([^"]*)"', after_choices)
            if answer_match:
                # Check it's not preceded by "correct"
                before_answer = content[search_start:search_start + answer_match.start()]
                if '"correct_answer"' not in before_answer:
                    # Remove this "answer" key-value pair
                    full_match_start = search_start + answer_match.start() - len('"answer":') - len(after_choices[:answer_match.start()].split('\n')[-1])
                    
                    # Find the actual start of "answer":
                    # Search backwards from the match position
                    search_back = content[max(0, search_start - 200):search_start + answer_match.start()]
                    answer_key_pos = search_back.rfind('"answer":')
                    if answer_key_pos != -1:
                        actual_start = max(0, search_start - 200) + answer_key_pos
                        
                        # Find the end (comma or newline after value)
                        value_end = content.find('"', answer_match.end())
                        if content[value_end + 1] == ',':
                            actual_end = value_end + 2  # include comma
                        else:
                            actual_end = value_end + 1
                        
                        # Remove it
                        new_content = content[:actual_start] + content[actual_end:]
                        local_removed += 1
                        content = new_content  # Update for next iteration in this file
        
        if local_removed > 0:
            # Validate before saving
            try:
                json.loads(new_content)
                with open(fpath, 'w', encoding='utf-8-sig') as f:
                    f.write(new_content)
                removed_count += local_removed
                files_fixed.append((fname, local_removed))
            except:
                pass

with open(r'D:\web app\4-craft.com\apps\api\remove_answer_result.txt', 'w') as f:
    f.write('Total answer fields removed: %d\n' % removed_count)
    f.write('Files fixed: %d\n' % len(files_fixed))
    for fname, count in files_fixed:
        f.write('  %s: %d removed\n' % (fname, count))

print('Done. Removed:', removed_count)
print('Files fixed:', len(files_fixed))