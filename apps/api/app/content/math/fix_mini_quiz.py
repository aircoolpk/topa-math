#!/usr/bin/env python3
"""
Fix mini_quiz blocks with placeholder choices and wrong answers
Target: apps/api/app/content/math/
"""

import json
import re
from pathlib import Path

BASE_DIR = Path(r"D:\web app\4-craft.com\apps\api\app\content\math")
LESSON_DIRS = ["grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6"]

def extract_numbers(text):
    """Extract all numbers from Thai text"""
    if not isinstance(text, str):
        return []
    # Find all digit sequences
    numbers = re.findall(r'\d+', text)
    return [int(n) for n in numbers]

def calculate_answer(question, lesson_id):
    """Calculate the correct answer based on question content"""
    numbers = extract_numbers(question)
    
    if not numbers:
        return None
    
    # For g1_time_basic: "นาฬิกาบอก X โมง อีก Y ชั่วโมง บอกกี่โมง?"
    if "นาฬิกา" in question or "โมง" in question:
        if "อีก" in question and "ชั่วโมง" in question:
            # Time addition: X o'clock + Y hours = ?
            if len(numbers) >= 2:
                return f"{numbers[0] + numbers[1]} โมง"
            elif len(numbers) == 1:
                return f"{numbers[0]} โมง"
    
    # For addition: "มี X อัน เพิ่มอีก Y อัน รวมกี่อัน?"
    if "เพิ่มอีก" in question or "รวม" in question:
        if len(numbers) >= 2:
            return str(numbers[0] + numbers[1])
        elif len(numbers) == 1:
            return str(numbers[0])
    
    # For subtraction: "มี X ชิ้น ใช้ไป Y ชิ้น เหลือกี่ชิ้น?"
    if "ใช้ไป" in question or "เหลือ" in question:
        if len(numbers) >= 2:
            return str(numbers[0] - numbers[1])
        elif len(numbers) == 1:
            return str(numbers[0])
    
    # For multiplication: "มี X กลุ่ม กลุ่มละ Y ชิ้น รวมกี่ชิ้น?"
    if "กลุ่มละ" in question or "คูณ" in question.lower():
        if len(numbers) >= 2:
            return str(numbers[0] * numbers[1])
    
    # For division: "แบ่งให้ X คน คนละกี่?"
    if "แบ่ง" in question or "หาร" in question or "÷" in question:
        if len(numbers) >= 2 and numbers[1] != 0:
            return str(numbers[0] // numbers[1])
    
    # Default: return first number
    return str(numbers[0]) if numbers else None

def generate_choices(correct_answer, question):
    """Generate 4 plausible choices including the correct answer"""
    numbers = extract_numbers(question)
    correct_val = extract_numbers(str(correct_answer)) if correct_answer else []
    correct_num = correct_val[0] if correct_val else 0
    
    choices = []
    
    if correct_num > 0:
        # Generate nearby values
        base = correct_num
        offsets = [-3, -1, 0, 1, 2, 3, 5]
        
        # Find 3 different wrong values
        wrong_values = set()
        for offset in offsets:
            val = base + offset
            if val > 0 and val != correct_num and len(str(val)) <= len(str(correct_num)) + 1:
                wrong_values.add(val)
            if len(wrong_values) >= 3:
                break
        
        # Build choices list with correct answer and 3 wrong
        choices = list(wrong_values)[:3]
        choices.append(correct_num)
        
        # Shuffle (keep track of correct position)
        import random
        random.seed(42)  # Consistent shuffling
        random.shuffle(choices)
        
        # Format as strings with Thai unit if present
        if "โมง" in str(correct_answer):
            choices = [f"{c} โมง" if c > 0 else str(c) for c in choices]
            correct_formatted = f"{correct_num} โมง"
        elif "ดวง" in str(correct_answer):
            choices = [f"{c} ดวง" if c > 0 else str(c) for c in choices]
            correct_formatted = f"{correct_num} ดวง"
        elif "ชิ้น" in str(correct_answer):
            choices = [f"{c} ชิ้น" if c > 0 else str(c) for c in choices]
            correct_formatted = f"{correct_num} ชิ้น"
        elif "ถุง" in str(correct_answer):
            choices = [f"{c} ถุง" if c > 0 else str(c) for c in choices]
            correct_formatted = f"{correct_num} ถุง"
        else:
            choices = [str(c) for c in choices]
            correct_formatted = str(correct_num)
    else:
        # Fallback: generic numeric choices
        choices = [str(correct_num - 2), str(correct_num - 1), str(correct_num), str(correct_num + 1)]
        correct_formatted = str(correct_num)
    
    return choices, correct_formatted

def fix_mini_quiz_block(block, lesson_id):
    """Fix a single mini_quiz block"""
    choices = block.get("choices", [])
    answer = block.get("answer", "")
    question = block.get("question", "")
    
    # Check if choices are placeholders
    is_placeholder = choices == ["A", "B", "C", "D"] or choices == ["A","B","C","D"]
    
    # Check if answer is a placeholder letter
    is_answer_placeholder = answer in ["A", "B", "C", "D"]
    
    # Check if answer exists in choices
    answer_in_choices = answer in choices
    
    if not is_placeholder and not is_answer_placeholder and answer_in_choices:
        return False  # No fix needed
    
    # Calculate correct answer
    correct_answer = calculate_answer(question, lesson_id)
    if not correct_answer:
        return False
    
    # Generate proper choices
    new_choices, correct_formatted = generate_choices(correct_answer, question)
    
    # Update block
    block["choices"] = new_choices
    block["answer"] = correct_formatted
    
    return True

def fix_lesson_file(filepath):
    """Fix mini_quiz blocks in a single lesson file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    lesson_id = data.get("lesson_id", filepath.stem)
    changes = {
        "mini_quiz_fixed": 0,
        "errors": []
    }
    
    if "lesson_variants" in data:
        for variant in data["lesson_variants"]:
            if "visual_blocks" in variant:
                for block in variant["visual_blocks"]:
                    if block.get("type") == "mini_quiz":
                        try:
                            fixed = fix_mini_quiz_block(block, lesson_id)
                            if fixed:
                                changes["mini_quiz_fixed"] += 1
                        except Exception as e:
                            changes["errors"].append(str(e))
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    return changes

def main():
    total_changes = {
        "files_modified": 0,
        "mini_quiz_fixed": 0,
        "errors": []
    }
    
    for grade_dir in LESSON_DIRS:
        dir_path = BASE_DIR / grade_dir / "lessons"
        if not dir_path.exists():
            continue
        
        for json_file in dir_path.glob("*.json"):
            if json_file.name.startswith("gen_") or json_file.name.startswith("check") or json_file.name.startswith("verify"):
                continue
            
            try:
                changes = fix_lesson_file(json_file)
                if changes["mini_quiz_fixed"] > 0:
                    print(f"[OK] {json_file.name} - fixed {changes['mini_quiz_fixed']} mini_quizzes")
                    total_changes["files_modified"] += 1
                    total_changes["mini_quiz_fixed"] += changes["mini_quiz_fixed"]
                    total_changes["errors"].extend(changes["errors"])
            except Exception as e:
                print(f"[FAIL] {json_file.name}: {e}")
                total_changes["errors"].append(f"{json_file.name}: {str(e)}")
    
    print("\n" + "="*50)
    print("MINI_QUIZ FIX SUMMARY")
    print("="*50)
    print(f"Files modified: {total_changes['files_modified']}")
    print(f"Mini quizzes fixed: {total_changes['mini_quiz_fixed']}")
    if total_changes['errors']:
        print(f"Errors: {len(total_changes['errors'])}")

if __name__ == "__main__":
    main()