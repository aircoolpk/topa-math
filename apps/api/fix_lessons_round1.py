import json
import shutil
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

BASE = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_3\lessons'
BACKUP = r'D:\web app\4-craft.com\apps\api\backup_lessons_round1'
os.makedirs(BACKUP, exist_ok=True)

files = {
    'g3_area_intro': 'g3_area_intro.json',
    'g3_division_intro': 'g3_division_intro.json',
    'g3_fractions_intro': 'g3_fractions_intro.json',
}

TYPE_MAP = {
    'emoji_counter': 'visual_thinking',
    'grouping_model': 'model_diagram',
    'bar_model': 'model_diagram',
    'shape_visual': 'model_diagram',
    'ten_frame': 'model_diagram',
    'area_model': 'model_diagram',
    'fraction_visual': 'model_diagram',
    'place_value_chart': 'model_diagram',
    'array_model': 'model_diagram',
    'graph_visual': 'model_diagram',
    'volume_visual': 'model_diagram',
    'table_visual': 'model_diagram',
    'count_back_strip': 'model_diagram',
}

ALLOWED = {'story_intro', 'visual_thinking', 'model_diagram', 'number_sentence', 'mini_quiz'}

stats = {k: {'blocks_normalized': 0, 'mini_quiz_fixed': 0, 'legacy_removed': 0} for k in files}

for lesson_key, filename in files.items():
    fp = BASE + '/' + filename
    shutil.copy2(fp, BACKUP + '/' + filename)
    
    with open(fp, 'rb') as f:
        obj = json.load(f)
    
    changes = []
    
    for variant in obj.get('lesson_variants', []):
        new_blocks = []
        for block in variant.get('visual_blocks', []):
            old_type = block.get('type', '')
            
            # Normalize block type
            new_type = TYPE_MAP.get(old_type, old_type)
            if old_type != new_type and old_type in TYPE_MAP:
                changes.append(f"  {variant['variant_id']}: {old_type} -> {new_type}")
                stats[lesson_key]['blocks_normalized'] += 1
            
            # Skip legacy blocks (step_cards, worked_example, common_mistakes)
            if old_type in {'step_cards', 'worked_example', 'common_mistakes'}:
                stats[lesson_key]['legacy_removed'] += 1
                continue
            
            # Only keep allowed block types
            if new_type not in ALLOWED:
                changes.append(f"  {variant['variant_id']}: skipped {old_type} (not allowed)")
                continue
            
            # Normalize block
            normalized = {'type': new_type}
            normalized.update(block)
            
            # Fix mini_quiz: add correct_answer, verify choices
            if new_type == 'mini_quiz':
                mq = block
                answer = mq.get('answer', '')
                choices = mq.get('choices', [])
                
                # Add correct_answer if missing
                if 'correct_answer' not in mq and answer:
                    normalized['correct_answer'] = answer
                    changes.append(f"  {variant['variant_id']}: mini_quiz added correct_answer={repr(answer)}")
                    stats[lesson_key]['mini_quiz_fixed'] += 1
                
                # Verify explanation_th exists
                if not mq.get('explanation_th'):
                    # Derive simple explanation
                    question = mq.get('question', '')
                    normalized['explanation_th'] = 'คำนวณตามโจทย์แล้วได้คำตอบที่ถูกต้อง'
                    changes.append(f"  {variant['variant_id']}: mini_quiz added explanation_th")
                
                # Normalize choices: must be list of strings
                if not isinstance(choices, list) or len(choices) == 0:
                    normalized['choices'] = ['ตัวเลือกไม่สมบูรณ์']
                
                # Normalize title
                if 'title' not in normalized:
                    normalized['title'] = '🎯 คำถาม'
            
            new_blocks.append(normalized)
        
        variant['visual_blocks'] = new_blocks
    
    with open(fp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    
    print(f'\n=== {lesson_key} ===')
    if changes:
        for c in changes[:20]:
            print(c)
        if len(changes) > 20:
            print(f'  ... and {len(changes)-20} more changes')
    else:
        print('  No changes needed')
    
    print(f'  Summary: blocks_normalized={stats[lesson_key]["blocks_normalized"]}, '
          f'mini_quiz_fixed={stats[lesson_key]["mini_quiz_fixed"]}, '
          f'legacy_removed={stats[lesson_key]["legacy_removed"]}')

print('\nDone. Backups in:', BACKUP)