#!/usr/bin/env python3
"""
Validate lesson content - check for remaining issues
Supports multiple block formats (Format A: direct fields, Format B: data.questions[])
"""

import json
from pathlib import Path

BASE_DIR = Path(r"D:\web app\4-craft.com\apps\api\app\content\math")
LESSON_DIRS = ["grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6"]

DEPRECATED_BLOCKS = {"step_cards", "worked_example", "common_mistakes"}

def get_mini_quiz_data(block):
    """Extract mini_quiz data from block, supporting both formats"""
    # Format A: direct fields
    if "choices" in block and "answer" in block:
        return {
            "question": block.get("question", ""),
            "choices": block.get("choices"),
            "answer": block.get("answer")
        }
    
    # Format B: data.questions[]
    if "data" in block and isinstance(block["data"], dict):
        questions = block["data"].get("questions", [])
        if questions and len(questions) > 0:
            q = questions[0]
            return {
                "question": q.get("text_th", q.get("text_en", "")),
                "choices": q.get("choices"),
                "answer": q.get("answer")
            }
    
    return None

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
                        mq = get_mini_quiz_data(block)
                        if mq:
                            choices = mq["choices"]
                            answer = mq["answer"]
                            question = mq["question"][:50] if mq["question"] else ""
                            
                            # Check placeholder choices
                            if choices == ["A", "B", "C", "D"]:
                                issues["placeholder_choices"] += 1
                            
                            # Check answer in choices
                            is_valid = False
                            if answer and choices:
                                if isinstance(choices, list) and len(choices) == 4:
                                    is_valid = answer in choices
                                elif choices is None:
                                    is_valid = False
                                else:
                                    is_valid = answer in choices
                            elif not choices:
                                is_valid = False
                            else:
                                is_valid = True  # No answer to check
                            
                            if not is_valid:
                                issues["wrong_answers"] += 1
                            
                            issues["mini_quizzes"].append({
                                "variant": variant_id,
                                "question": question,
                                "choices": choices,
                                "answer": answer,
                                "answer_valid": is_valid
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
                    issues["no_ep_variant"]
                )
                
                # Also check if any mini_quiz has invalid answer
                has_invalid_mq = any(not mq["answer_valid"] for mq in issues["mini_quizzes"] if mq["choices"] is not None)
                if has_invalid_mq:
                    has_issues = True
                
                if has_issues:
                    all_issues["files_with_issues"] += 1
                    problem_entry = {
                        "file": json_file.name,
                        "grade": grade_dir,
                        "deprecated_blocks": issues["deprecated_blocks"],
                        "placeholder_choices": issues["placeholder_choices"],
                        "wrong_answers": issues["wrong_answers"],
                        "no_ep_variant": issues["no_ep_variant"],
                        "mini_quizzes_invalid": sum(1 for mq in issues["mini_quizzes"] if not mq["answer_valid"] and mq["choices"] is not None)
                    }
                    all_issues["problem_files"].append(problem_entry)
                
                all_issues["deprecated_blocks"] += issues["deprecated_blocks"]
                all_issues["placeholder_choices"] += issues["placeholder_choices"]
                all_issues["wrong_answers"] += issues["wrong_answers"]
                all_issues["story_mismatch"] += issues["story_mismatch"]
                if issues["no_ep_variant"]:
                    all_issues["no_ep_variant"] += 1
                
                valid_mqs = sum(1 for mq in issues["mini_quizzes"] if mq["answer_valid"] and mq["choices"] is not None)
                total_mqs = sum(1 for mq in issues["mini_quizzes"] if mq["choices"] is not None)
                all_issues["mini_quizzes_total"] += total_mqs
                all_issues["mini_quizzes_valid"] += valid_mqs
                
            except Exception as e:
                print(f"[ERROR] {json_file.name}: {e}")
    
    print("="*60)
    print("VALIDATION SUMMARY (UPDATED)")
    print("="*60)
    print(f"Total files scanned: {all_issues['total_files']}")
    print(f"Files with issues: {all_issues['files_with_issues']}")
    print()
    print(f"Deprecated blocks remaining: {all_issues['deprecated_blocks']}")
    print(f"Placeholder choices: {all_issues['placeholder_choices']}")
    print(f"Wrong answers: {all_issues['wrong_answers']}")
    print(f"Missing EP variant: {all_issues['no_ep_variant']}")
    print()
    print(f"Mini quizzes: {all_issues['mini_quizzes_valid']}/{all_issues['mini_quizzes_total']} valid")
    print()
    
    if all_issues["problem_files"]:
        print("PROBLEM FILES:")
        for pf in all_issues["problem_files"][:15]:
            print(f"  [{pf['grade']}] {pf['file']}")
            if pf['deprecated_blocks'] > 0:
                print(f"    - Deprecated blocks: {pf['deprecated_blocks']}")
            if pf['placeholder_choices'] > 0:
                print(f"    - Placeholder choices: {pf['placeholder_choices']}")
            if pf['wrong_answers'] > 0:
                print(f"    - Wrong answers: {pf['wrong_answers']}")
            if pf['no_ep_variant']:
                print(f"    - No EP variant")
            if pf['mini_quizzes_invalid'] > 0:
                print(f"    - Invalid mini_quiz: {pf['mini_quizzes_invalid']}")
    
    # Save to JSON
    with open(BASE_DIR / "LESSON_CONTENT_FIX_VALIDATION.json", 'w', encoding='utf-8') as f:
        json.dump(all_issues, f, ensure_ascii=False, indent=2)
    
    print(f"\nFull report saved to LESSON_CONTENT_FIX_VALIDATION.json")

if __name__ == "__main__":
    main()