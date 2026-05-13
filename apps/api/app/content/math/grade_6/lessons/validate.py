import json
import os

LESSONS_DIR = r"D:\web app\4-craft.com\apps\api\app\content\math\grade_6\lessons"
LESSON_FILES = [
    "g6_equations_intro",
    "g6_fraction_decimal_percent",
    "g6_gcf_lcm",
    "g6_geometry",
    "g6_middle_school_prep",
    "g6_ratio_proportion",
    "g6_volume"
]

for lesson_file in LESSON_FILES:
    file_path = os.path.join(LESSONS_DIR, f"{lesson_file}.json")
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    variants = data.get("lesson_variants", [])
    print(f"{lesson_file}: {len(variants)} variants")
    
    for v in variants:
        blocks = v.get("visual_blocks", [])
        block_types = [b.get("type", "NO_TYPE") for b in blocks]
        print(f"  {v['variant_id']}: {block_types}")
