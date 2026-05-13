#!/usr/bin/env python3
"""
Validate lesson content - check for remaining issues
"""

import json
from pathlib import Path

BASE_DIR = Path(r"D:\web app\4-craft.com\apps\api\app\content\math")
LESSON_DIRS = ["grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6"]

DEPRECATED_BLOCKS = {"step_cards", "worked_example", "common_mistakes"}

def validate_lesson_file(filepath):
    """Validate a single lesson file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    issues = {
        "deprecated_blocks": 0,
        "placeholder_choices": 0,
        "wrong_answers": 0,
        "story_mismatch": 0,
        "no_ep_variant": False,
        "mini_quizzes": []
    }
    
    lesson_id = data.get("lesson_id", filepath.stem)
    
    # Check for EP variant
    has_ep = any(v.get("variant_id", "").startswith("ep_") for v in data.get("lesson_variants", []))
    if not has_ep:
        issues["no_ep_variant"] = True
    
    # Check visual_blocks
    if "lesson_variants" in data:
        for variant in data["lesson_variants"]:
            variant_id = variant.get("variant_id", "?")
            story_theme = variant.get("story_theme_th", "")
            
            if "visual_blocks" in variant:
                for block in variant["visual_blocks"]:
                    block_type = block.get("type", "")
                    
                    # Check deprecated blocks
                    if block_type in DEPRECATED_BLOCKS:
                        issues["deprecated_blocks"] += 1
                    
                    # Check mini_quiz
                    if block_type == "mini_quiz":
                        choices = block.get("choices", [])
                        answer = block.get("answer", "")
                        question = block.get("question", "")[:50]
                        
                        # Check placeholder choices
                        if choices == ["A", "B", "C", "D"]:
                            issues["placeholder_choices"] += 1
                        
                        # Check answer in choices
                        if answer and choices and answer not in choices:
                            issues["wrong_answers"] += 1
                        
                        # Store mini_quiz info
                        issues["mini_quizzes"].append({
                            "variant": variant_id,
                            "question": question,
                            "choices": choices,
                            "answer": answer,
                            "answer_valid": answer in choices if answer and choices else False
                        })
    
    return issues

def main():
    all_issues = {
        "total_files": 0,
        "files_with_issues": 0,
        "deprecated_blocks": 0,
        "placeholder_choices": 0,
        "wrong_answers": 0,
        "story_mismatch": 0,
        "no_ep_variant": 0,
        "mini_quizzes_total": 0,
        "mini_quizzes_valid": 0,
        "problem_files": []
    }
    
    for grade_dir in LESSON_DIRS:
        dir_path = BASE_DIR / grade_dir / "lessons"
        if not dir_path.exists():
            continue
        
        for json_file in dir_path.glob("*.json"):
            if json_file.name.startswith("gen_") or json_file.name.startswith("check") or json_file.name.startswith("verify"):
                continue
            
            all_issues["total_files"] += 1
            
            try:
                issues = validate_lesson_file(json_file)
                
                has_issues = (
                    issues["deprecated_blocks"] > 0 or
                    issues["placeholder_choices"] > 0 or
                    issues["wrong_answers"] > 0 or
                    issues["story_mismatch"] > 0 or
                    issues["no_ep_variant"] or
                    any(not mq["answer_valid"] for mq in issues["mini_quizzes"])
                )
                
                if has_issues:
                    all_issues["files_with_issues"] += 1
                    all_issues["problem_files"].append({
                        "file": json_file.name,
                        "grade": grade_dir,
                        **issues
                    })
                
                all_issues["deprecated_blocks"] += issues["deprecated_blocks"]
                all_issues["placeholder_choices"] += issues["placeholder_choices"]
                all_issues["wrong_answers"] += issues["wrong_answers"]
                all_issues["story_mismatch"] += issues["story_mismatch"]
                if issues["no_ep_variant"]:
                    all_issues["no_ep_variant"] += 1
                all_issues["mini_quizzes_total"] += len(issues["mini_quizzes"])
                all_issues["mini_quizzes_valid"] += sum(1 for mq in issues["mini_quizzes"] if mq["answer_valid"])
                
            except Exception as e:
                print(f"[ERROR] {json_file.name}: {e}")
    
    print("="*60)
    print("VALIDATION SUMMARY")
    print("="*60)
    print(f"Total files scanned: {all_issues['total_files']}")
    print(f"Files with issues: {all_issues['files_with_issues']}")
    print(f"")
    print(f"Deprecated blocks remaining: {all_issues['deprecated_blocks']}")
    print(f"Placeholder choices: {all_issues['placeholder_choices']}")
    print(f"Wrong answers: {all_issues['wrong_answers']}")
    print(f"Story mismatch: {all_issues['story_mismatch']}")
    print(f"Missing EP variant: {all_issues['no_ep_variant']}")
    print(f"")
    print(f"Mini quizzes: {all_issues['mini_quizzes_valid']}/{all_issues['mini_quizzes_total']} valid")
    print(f"")
    
    if all_issues["problem_files"]:
        print("PROBLEM FILES:")
        for pf in all_issues["problem_files"][:10]:
            print(f"  [{pf['grade']}] {pf['file']}")
            if pf['deprecated_blocks'] > 0:
                print(f"    - Deprecated blocks: {pf['deprecated_blocks']}")
            if pf['placeholder_choices'] > 0:
                print(f"    - Placeholder choices: {pf['placeholder_choices']}")
            if pf['wrong_answers'] > 0:
                print(f"    - Wrong answers: {pf['wrong_answers']}")
            if pf['no_ep_variant']:
                print(f"    - No EP variant")
            if pf['mini_quizzes']:
                invalid_mq = [mq for mq in pf['mini_quizzes'] if not mq['answer_valid']]
                if invalid_mq:
                    print(f"    - Invalid mini_quiz: {len(invalid_mq)}")
    
    # Save to JSON
    with open(BASE_DIR / "LESSON_CONTENT_FIX_VALIDATION.json", 'w', encoding='utf-8') as f:
        json.dump(all_issues, f, ensure_ascii=False, indent=2)
    
    print(f"\nFull report saved to LESSON_CONTENT_FIX_VALIDATION.json")

if __name__ == "__main__":
    main()