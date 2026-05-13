import json, os

# Check original file (before any Round 2 processing)
# Use the file from grade_2\lessons that was NOT modified yet
# We need to see the ORIGINAL content

# Let's check what's in backup_miniquiz_round2 vs the CURRENT files
# and validate BOTH to understand what was wrong before vs after

backup_dir = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2'
current_dir = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'

for fname in ['g2_add_two_digit.json', 'g2_times_table_2_5_10.json']:
    print(f'\n=== {fname} ===')
    
    for label, dir_path in [('BACKUP', backup_dir), ('CURRENT', current_dir)]:
        fpath = os.path.join(dir_path, fname)
        try:
            with open(fpath, 'r', encoding='utf-8-sig') as f:
                json.load(f)
            print(f'  {label}: VALID JSON')
        except Exception as e:
            print(f'  {label}: INVALID - {str(e)[:100]}')
        
        # Check for placeholder
        with open(fpath, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        count = content.count('See correct answer above')
        print(f'  {label}: Placeholder count = {count}')
        
        # Check for Thai explanation
        thai_count = content.count('ดูตัวอย่างในบทเรียน')
        print(f'  {label}: Thai explanation count = {thai_count}')
