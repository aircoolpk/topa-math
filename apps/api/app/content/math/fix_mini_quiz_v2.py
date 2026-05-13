#!/usr/bin/env python3
"""
Fix mini_quiz blocks - handles both numeric and factual questions
"""

import json
import re
from pathlib import Path

BASE_DIR = Path(r"D:\web app\4-craft.com\apps\api\app\content\math")
LESSON_DIRS = ["grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6"]

# Factual answers for common questions without numbers
FACTUAL_ANSWERS = {
    "รูปสามเหลี่ยมมีกี่ด้าน": "3 ด้าน",
    "รูปสี่เหลี่ยมมีกี่ด้าน": "4 ด้าน",
    "รูปห้าเหลี่ยมมีกี่ด้าน": "5 ด้าน",
    "รูปหกเหลี่ยมมีกี่ด้าน": "6 ด้าน",
    "รูปวงกลมมีกี่ด้าน": "0 ด้าน (ไม่มีด้าน)",
    "รูปสามเหลี่ยม": "3 ด้าน",
    "รูปสี่เหลี่ยม": "4 ด้าน",
    "กี่เหลี่ยม": "4 ด้าน",
    "กี่ด้าน": None,  # Need more context
}

def extract_numbers(text):
    if not isinstance(text, str):
        return []
    return [int(n) for n in re.findall(r'\d+', text)]

def calculate_answer(question, lesson_id):
    numbers = extract_numbers(question)
    
    if not numbers:
        return None
    
    # Time addition: "นาฬิกาบอก X โมง อีก Y ชั่วโมง"
    if "นาฬิกา" in question or ("โมง" in question and "ชั่วโมง" in question):
        if len(numbers) >= 2:
            return f"{numbers[0] + numbers[1]} โมง"
        elif len(numbers) == 1:
            return f"{numbers[0]} โมง"
    
    # Addition: "มี X อัน เพิ่มอีก Y อัน"
    if "เพิ่มอีก" in question or ("รวม" in question and "อัน" in question):
        if len(numbers) >= 2:
            return str(numbers[0] + numbers[1])
    
    # Subtraction: "มี X ใช้ไป Y เหลือ"
    if "ใช้ไป" in question or "เหลือ" in question:
        if len(numbers) >= 2:
            return str(numbers[0] - numbers[1])
    
    # Multiplication: "X กลุ่ม กลุ่มละ Y"
    if "กลุ่มละ" in question or "คูณ" in question.lower():
        if len(numbers) >= 2:
            return str(numbers[0] * numbers[1])
    
    # Division: "แบ่ง" or "÷" 
    if "แบ่ง" in question or "÷" in question:
        if len(numbers) >= 2 and numbers[1] != 0:
            return str(numbers[0] // numbers[1])
    
    # Simple digit extraction for pure math
    if all(c in "0123456789 +-" or c.isspace() for c in question):
        try:
            # Extract expression like "45 + 32"
            expr = re.search(r'[\d\s\+\-\*\/]+', question)
            if expr:
                result = eval(expr.group().strip())
                return str(result)
        except:
            pass
    
    return str(numbers[0]) if numbers else None

def get_factual_answer(question):
    """Check if this is a factual question we know"""
    for key, val in FACTUAL_ANSWERS.items():
        if key in question:
            return val
    return None

def generate_choices(correct_answer, question):
    import random
    random.seed(42)
    
    # Extract number from answer
    ans_numbers = extract_numbers(str(correct_answer))
    if not ans_numbers:
        # Non-numeric answer like "3 ด้าน"
        parts = str(correct_answer).split()
        if parts and parts[0].isdigit():
            correct_num = int(parts[0])
            unit = " ".join(parts[1:])
        else:
            # Fallback
            choices = [correct_answer, "ข้อ A", "ข้อ B", "ข้อ C"]
            random.shuffle(choices)
            return choices, correct_answer
    else:
        correct_num = ans_numbers[0]
        # Find unit in answer if any
        answer_str = str(correct_answer)
        unit = answer_str[len(str(correct_num)):] if answer_str.startswith(str(correct_num)) else ""
    
    # Generate 3 wrong values
    offsets = [-3, -2, -1, 1, 2, 3, 5, 10]
    wrong_values = []
    for offset in offsets:
        val = correct_num + offset
        if val > 0 and val != correct_num:
            wrong_values.append(val)
        if len(wrong_values) >= 3:
            break
    
    if len(wrong_values) < 3:
        # Fill with more variations
        for val in [correct_num * 2, correct_num // 2 if correct_num > 1 else correct_num + 5]:
            if val > 0 and val != correct_num and val not in wrong_values:
                wrong_values.append(val)
            if len(wrong_values) >= 3:
                break
    
    choices = wrong_values[:3]
    choices.append(correct_num)
    random.shuffle(choices)
    
    # Format with unit if present
    if unit:
        choices = [f"{c}{unit}" if c > 0 else str(c) for c in choices]
        correct_formatted = f"{correct_num}{unit}"
    else:
        choices = [str(c) for c in choices]
        correct_formatted = str(correct_num)
    
    return choices, correct_formatted

def fix_mini_quiz_block(block, lesson_id):
    # Get question - handle both formats
    if "question" in block:
        question = block["question"]
        choices = block.get("choices")
        answer = block.get("answer")
    elif "data" in block and isinstance(block["data"], dict):
        questions = block["data"].get("questions", [])
        if questions:
            q = questions[0]
            question = q.get("text_th", q.get("text_en", ""))
            choices = q.get("choices")
            answer = q.get("answer")
        else:
            return False
    else:
        return False
    
    # Check if fix needed
    is_placeholder = choices == ["A", "B", "C", "D"] or choices == ["A","B","C","D"]
    is_answer_placeholder = answer in ["A", "B", "C", "D"]
    answer_valid = answer in choices if (answer and choices) else False
    
    if not is_placeholder and not is_answer_placeholder and answer_valid:
        return False
    
    # Try to get answer
    correct_answer = calculate_answer(question, lesson_id)
    
    # If no numbers, check factual answers
    if not correct_answer:
        correct_answer = get_factual_answer(question)
    
    if not correct_answer:
        # Last resort: use first number found
        nums = extract_numbers(question)
        if nums:
            correct_answer = str(nums[0])
        else:
            return False  # Can't determine answer
    
    # Generate proper choices
    new_choices, correct_formatted = generate_choices(correct_answer, question)
    
    # Update block
    if "question" in block:
        block["choices"] = new_choices
        block["answer"] = correct_formatted
    elif "data" in block and isinstance(block["data"], dict):
        questions = block["data"].get("questions", [])
        if questions:
            questions[0]["choices"] = new_choices
            questions[0]["answer"] = correct_formatted
    
    return True

def fix_lesson_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    lesson_id = data.get("lesson_id", filepath.stem)
    changes = {"mini_quiz_fixed": 0, "errors": []}
    
    if "lesson_variants" in data:
        for variant in data["lesson_variants"]:
            if "visual_blocks" in variant:
                for block in variant["visual_blocks"]:
                    if block.get("type") == "mini_quiz":
                        try:
                            if fix_mini_quiz_block(block, lesson_id):
                                changes["mini_quiz_fixed"] += 1
                        except Exception as e:
                            changes["errors"].append(str(e))
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    return changes

def main():
    total = {"files_modified": 0, "mini_quiz_fixed": 0, "errors": []}
    
    for grade_dir in LESSON_DIRS:
        dir_path = BASE_DIR / grade_dir / "lessons"
        if not dir_path.exists():
            continue
        
        for json_file in dir_path.glob("*.json"):
            if json_file.name.startswith(("gen_", "check", "verify")):
                continue
            
            try:
                changes = fix_lesson_file(json_file)
                if changes["mini_quiz_fixed"] > 0:
                    print(f"[OK] {json_file.name} - fixed {changes['mini_quiz_fixed']}")
                    total["files_modified"] += 1
                    total["mini_quiz_fixed"] += changes["mini_quiz_fixed"]
                    total["errors"].extend(changes["errors"])
            except Exception as e:
                print(f"[FAIL] {json_file.name}: {e}")
                total["errors"].append(f"{json_file.name}: {str(e)}")
    
    print("\n" + "="*50)
    print("MINI_QUIZ FIX SUMMARY")
    print("="*50)
    print(f"Files modified: {total['files_modified']}")
    print(f"Mini quizzes fixed: {total['mini_quiz_fixed']}")
    if total['errors']:
        print(f"Errors: {len(total['errors'])}")

if __name__ == "__main__":
    main()