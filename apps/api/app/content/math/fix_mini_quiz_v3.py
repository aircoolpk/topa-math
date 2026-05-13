#!/usr/bin/env python3
"""
Fix mini_quiz blocks - handles missing choices/answer in data.questions[]
"""

import json
import re
import random
from pathlib import Path

BASE_DIR = Path(r"D:\web app\4-craft.com\apps\api\app\content\math")
LESSON_DIRS = ["grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6"]

# Known shape facts
SHAPE_FACTS = {
    "สามเหลี่ยม": "3 ด้าน",
    "สี่เหลี่ยม": "4 ด้าน",
    "ห้าเหลี่ยม": "5 ด้าน",
    "หกเหลี่ยม": "6 ด้าน",
    "วงกลม": "0 ด้าน (ไม่มีด้าน)",
    "รูปสามเหลี่ยม": "3 ด้าน",
    "รูปสี่เหลี่ยม": "4 ด้าน",
}

def extract_numbers(text):
    if not isinstance(text, str):
        return []
    return [int(n) for n in re.findall(r'\d+', text)]

def calculate_answer(question, lesson_id):
    numbers = extract_numbers(question)
    if not numbers:
        return None
    
    if "นาฬิกา" in question or ("โมง" in question and "ชั่วโมง" in question):
        if len(numbers) >= 2:
            return f"{numbers[0] + numbers[1]} โมง"
        return f"{numbers[0]} โมง"
    
    if "เพิ่มอีก" in question or ("รวม" in question and "อัน" in question):
        if len(numbers) >= 2:
            return str(numbers[0] + numbers[1])
    
    if "ใช้ไป" in question or "เหลือ" in question:
        if len(numbers) >= 2:
            return str(numbers[0] - numbers[1])
    
    if "กลุ่มละ" in question or "คูณ" in question.lower():
        if len(numbers) >= 2:
            return str(numbers[0] * numbers[1])
    
    if "แบ่ง" in question or "÷" in question:
        if len(numbers) >= 2 and numbers[1] != 0:
            return str(numbers[0] // numbers[1])
    
    # Simple math expression
    expr = re.search(r'[\d\s\+\-\*\/]+', question)
    if expr:
        try:
            result = eval(expr.group().strip())
            return str(result)
        except:
            pass
    
    return str(numbers[0])

def get_factual_answer(question):
    for key, val in SHAPE_FACTS.items():
        if key in question:
            return val
    return None

def generate_choices_for_shapes(correct_answer):
    """Generate choices for shape questions"""
    correct_num = extract_numbers(str(correct_answer))
    if not correct_num:
        return [correct_answer, "ไม่ทราบ", "ข้อ ก", "ข้อ ข"]
    
    correct_num = correct_num[0]
    unit = str(correct_answer).replace(str(correct_num), "", 1).strip()
    
    offsets = [-2, -1, 1, 2]
    wrong = []
    for o in offsets:
        v = correct_num + o
        if v > 0:
            wrong.append(v)
        if len(wrong) >= 3:
            break
    
    while len(wrong) < 3:
        wrong.append(correct_num + len(wrong) + 2)
    
    choices = wrong[:3]
    choices.append(correct_num)
    random.seed(42)
    random.shuffle(choices)
    
    if unit:
        choices = [f"{c}{unit}" for c in choices]
        correct_formatted = f"{correct_num}{unit}"
    else:
        choices = [str(c) for c in choices]
        correct_formatted = str(correct_num)
    
    return choices, correct_formatted

def fix_mini_quiz_block(block, lesson_id):
    # Format A: direct fields
    if "question" in block:
        question = block["question"]
        choices = block.get("choices")
        answer = block.get("answer")
        
        is_placeholder = choices == ["A", "B", "C", "D"]
        is_answer_placeholder = answer in ["A", "B", "C", "D"]
        answer_valid = answer in choices if (answer and choices) else False
        
        if not is_placeholder and not is_answer_placeholder and answer_valid:
            return False
        
        correct_answer = calculate_answer(question, lesson_id)
        if not correct_answer:
            correct_answer = get_factual_answer(question)
        if not correct_answer:
            nums = extract_numbers(question)
            if nums:
                correct_answer = str(nums[0])
            else:
                return False
        
        new_choices, correct_formatted = generate_choices_for_shapes(correct_answer)
        block["choices"] = new_choices
        block["answer"] = correct_formatted
        return True
    
    # Format B: data.questions[]
    if "data" in block and isinstance(block["data"], dict):
        questions = block["data"].get("questions", [])
        if not questions:
            return False
        
        q = questions[0]
        question = q.get("text_th", q.get("text_en", ""))
        choices = q.get("choices")
        answer = q.get("answer")
        
        # If choices/answer are missing or None, we need to generate them
        needs_fix = (choices is None or choices == [] or choices == ["A", "B", "C", "D"] or
                     answer is None or answer == "" or answer in ["A", "B", "C", "D"])
        
        if not needs_fix and answer in choices:
            return False
        
        correct_answer = calculate_answer(question, lesson_id)
        if not correct_answer:
            correct_answer = get_factual_answer(question)
        if not correct_answer:
            nums = extract_numbers(question)
            if nums:
                correct_answer = str(nums[0])
            else:
                return False
        
        new_choices, correct_formatted = generate_choices_for_shapes(correct_answer)
        q["choices"] = new_choices
        q["answer"] = correct_formatted
        return True
    
    return False

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
    print("MINI_QUIZ FIX v2 SUMMARY")
    print("="*50)
    print(f"Files modified: {total['files_modified']}")
    print(f"Mini quizzes fixed: {total['mini_quiz_fixed']}")

if __name__ == "__main__":
    main()