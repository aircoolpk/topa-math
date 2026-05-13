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

STORY_THEMES = [
    ("🏫", "โรงเรียน"),
    ("🍎", "ผลไม้"),
    ("🧸", "ของเล่น"),
    ("🏪", "ตลาด"),
    ("🐕", "สัตว์เลี้ยง"),
    ("🌻", "สวน"),
    ("🎨", "วาดรูป"),
    ("📚", "ห้องเรียน"),
    ("🎮", "สนุกกับเพื่อน"),
    ("🎉", "งานเทศกาล"),
]

def get_model_type(lesson_id):
    """Return appropriate model type for each lesson."""
    models = {
        "g6_equations_intro": "bar_model",
        "g6_fraction_decimal_percent": "fraction_visual",
        "g6_gcf_lcm": "bar_model",
        "g6_geometry": "area_model",
        "g6_middle_school_prep": "bar_model",
        "g6_ratio_proportion": "graph_visual",
        "g6_volume": "volume_visual",
    }
    return models.get(lesson_id, "bar_model")

def get_content_for_lesson(lesson_id, variant_idx):
    """Return content tailored to each lesson."""
    emoji, theme = STORY_THEMES[variant_idx]
    
    contents = {
        "g6_equations_intro": {
            "story_intro": f"ที่{emoji} {theme} มีลูกบอล x ลูก เพื่อนให้อีก 5 ลูก รวมเป็น 12 ลูก ถามว่า x คือเท่าไหร่?",
            "emoji_counter": {
                "items_before": "⚽" * 3,
                "items_added": "➕🔵🔵🔵🔵🔵",
                "question": f"มีลูกบอล x ลูก + เพื่อนให้ 5 ลูก = 12 ลูก หาค่า x"
            },
            "model": {
                "type": "bar_model",
                "title": "🟦 ลองใช้ Model",
                "content": "ใช้แท่งแสดงค่า x และ 5 รวมเป็น 12"
            },
            "step_cards": ["เขียนสมการ: x + 5 = 12", "ต้องการให้ x อยู่ข้างเดียว", "ลบ 5 ทั้งสองข้าง: x = 12 - 5", "ได้คำตอบ: x = 7"],
            "number_sentence": "x + 5 = 12 → x = 12 - 5 → x = 7",
            "worked_example": {
                "question_th": "x + 5 = 12 หาค่า x",
                "solution_steps": ["ต้องการ x = ?", "ลบ 5 ทั้งสองข้าง", "x = 12 - 5", "x = 7"],
                "answer_th": "x = 7"
            },
            "common_mistakes": ["บวกแทนลบ → ทำผิด", "ทำไม่เหมือนกันทั้งสองข้าง", "ลืมตรวจคำตอบ"],
            "mini_quiz": {
                "question": "x + 8 = 15 หาค่า x",
                "choices": ["x = 5", "x = 6", "x = 7", "x = 8"],
                "answer": "x = 7",
                "explanation": "x = 15 - 8 = 7"
            }
        },
        "g6_fraction_decimal_percent": {
            "story_intro": f"ที่{emoji} {theme} มีพิซซ่า 1 ก้อน แบ่งให้เพื่อน 3 คน คนละเท่าๆ กัน แต่ละคนได้เท่าไหร่? 🍕",
            "emoji_counter": {
                "items_before": "🍕",
                "items_added": "÷ 3",
                "question": f"พิซซ่า 1 ก้อน แบ่ง 3 คน คนละกี่ส่วน?"
            },
            "model": {
                "type": "fraction_visual",
                "title": "🟦 ลองใช้ Model",
                "content": "แบ่งพิซซ่าเป็น 3 ส่วนเท่าๆ กัน"
            },
            "step_cards": ["เขียนเศษส่วน: 1 ÷ 3", "แปลงเป็นเศษส่วน: 1/3", "เขียนเป็นทศนิยม: 0.333...", "เขียนเป็นเปอร์เซ็นต์: 33.33%"],
            "number_sentence": "1 ÷ 3 = 1/3 ≈ 0.333 = 33.33%",
            "worked_example": {
                "question_th": "2/5 เขียนเป็นทศนิยมและเปอร์เซ็นต์",
                "solution_steps": ["2/5 = 2 ÷ 5", "2 ÷ 5 = 0.4", "0.4 × 100 = 40%"],
                "answer_th": "0.4 และ 40%"
            },
            "common_mistakes": ["ลืมว่า % คือ ÷100", "สลับเศษส่วนกับส่วน", "ปัดเศษผิด"],
            "mini_quiz": {
                "question": "1/4 เขียนเป็นเปอร์เซ็นต์ได้เท่าไหร่?",
                "choices": ["14%", "25%", "40%", "50%"],
                "answer": "25%",
                "explanation": "1/4 = 0.25 = 25%"
            }
        },
        "g6_gcf_lcm": {
            "story_intro": f"ที่{emoji} {theme} มีลูกปัดสีแดง 12 ลูก และสีน้ำเงิน 18 ลูก ต้องการแบ่งเป็นกองๆ โดยแต่ละกองมีลูกปัดสีเดียวกัน จะแบ่งได้กี่กอง?",
            "emoji_counter": {
                "items_before": "🔴" * 12 + "🔵" * 18,
                "items_added": "÷",
                "question": "หาการหารร่วมมากที่สุด (หรม.) ของ 12 กับ 18"
            },
            "model": {
                "type": "bar_model",
                "title": "🟦 ลองใช้ Model",
                "content": "ใช้แท่งตัวเลขหาตัวหารร่วม"
            },
            "step_cards": ["เขียนตัวประกอบของ 12: 1,2,3,4,6,12", "เขียนตัวประกอบของ 18: 1,2,3,6,9,18", "หาตัวประกอบร่วม: 1,2,3,6", "หรม.คือ 6"],
            "number_sentence": "หรม.(12,18) = 6",
            "worked_example": {
                "question_th": "หา หรม. ของ 12 กับ 18",
                "solution_steps": ["ตัวประกอบ 12: 1,2,3,4,6,12", "ตัวประกอบ 18: 1,2,3,6,9,18", "ตัวประกอบร่วม: 1,2,3,6", "หรม. = 6"],
                "answer_th": "6"
            },
            "common_mistakes": ["ใช้ตัวคูณแทนตัวประกอบ", "ลืมว่า 1 เป็นตัวประกอบทุกจำนวน", "สลับหรม.กับครน."],
            "mini_quiz": {
                "question": "หรม. ของ 8 กับ 12 คือเท่าไหร่?",
                "choices": ["2", "4", "6", "8"],
                "answer": "4",
                "explanation": "ตัวประกอบ 8: 1,2,4,8 | ตัวประกอบ 12: 1,2,3,4,6,12 | หรม. = 4"
            }
        },
        "g6_geometry": {
            "story_intro": f"ที่{emoji} {theme} มีสวนรูปสี่เหลี่ยมผืนผ้า กว้าง 8 เมตร ยาว 12 เมตร อยากรู้ว่าสวนนี้มีพื้นที่เท่าไหร่? 🌿",
            "emoji_counter": {
                "items_before": "📐",
                "items_added": "8 × 12",
                "question": "หาพื้นที่สี่เหลี่ยมผืนผ้า กว้าง 8 ยาว 12"
            },
            "model": {
                "type": "area_model",
                "title": "🟦 ลองใช้ Model",
                "content": "วาดรูปสี่เหลี่ยมผืนผ้า แบ่งเป็นตารางเล็กๆ"
            },
            "step_cards": ["รู้กว้าง = 8 เมตร", "รู้ยาว = 12 เมตร", "ใช้สูตร: กว้าง × ยาว", "คำนวณ: 8 × 12 = 96 ตารางเมตร"],
            "number_sentence": "พื้นที่ = 8 × 12 = 96 ตร.ม.",
            "worked_example": {
                "question_th": "สี่เหลี่ยมผืนผ้ากว้าง 8 ยาว 12 หาพื้นที่",
                "solution_steps": ["ใช้สูตร: กว้าง × ยาว", "แทนค่า: 8 × 12", "คูณ: 8 × 12 = 96"],
                "answer_th": "96 ตารางเมตร"
            },
            "common_mistakes": ["ใช้สูตรผิด เช่น ก + ย แทน ก × ย", "ลืมใส่หน่วย ตร.ม.", "วัดด้านผิด"],
            "mini_quiz": {
                "question": "สี่เหลี่ยมจัตุรัสด้านละ 9 ซม. มีพื้นที่เท่าไหร่?",
                "choices": ["18 ตร.ซม.", "36 ตร.ซม.", "81 ตร.ซม.", "90 ตร.ซม."],
                "answer": "81 ตร.ซม.",
                "explanation": "พื้นที่ = 9 × 9 = 81 ตร.ซม."
            }
        },
        "g6_middle_school_prep": {
            "story_intro": f"ที่{emoji} {theme} อลินเตรียมของใช้ซื้อดินสอ 12 แท่ง ไปแบ่งให้เพื่อน 4 คน คนละเท่าๆ กัน แต่ละคนได้กี่แท่ง? ✏️",
            "emoji_counter": {
                "items_before": "✏️" * 12,
                "items_added": "÷ 4 คน",
                "question": "แบ่งดินสอ 12 แท่ง ให้ 4 คน คนละกี่แท่ง?"
            },
            "model": {
                "type": "bar_model",
                "title": "🟦 ลองใช้ Model",
                "content": "แบ่งดินสอเป็น 4 กลุ่มเท่าๆ กัน"
            },
            "step_cards": ["มีดินสอ 12 แท่ง", "แบ่งให้ 4 คน", "ใช้การหาร: 12 ÷ 4", "ได้คนละ 3 แท่ง"],
            "number_sentence": "12 ÷ 4 = 3",
            "worked_example": {
                "question_th": "มีดินสอ 15 แท่ง แบ่งให้เพื่อน 5 คน คนละเท่าไหร่?",
                "solution_steps": ["มีดินสอ 15 แท่ง", "แบ่งให้ 5 คน", "15 ÷ 5 = 3"],
                "answer_th": "คนละ 3 แท่ง"
            },
            "common_mistakes": ["คูณแทนหาร", "แบ่งไม่เท่ากัน", "ลืมว่าต้องแบ่งให้เพื่อน"],
            "mini_quiz": {
                "question": "24 ÷ 6 = ?",
                "choices": ["3", "4", "5", "6"],
                "answer": "4",
                "explanation": "24 ÷ 6 = 4 เพราะ 6 × 4 = 24"
            }
        },
        "g6_ratio_proportion": {
            "story_intro": f"ที่{emoji} {theme} มีน้ำเชื่อม 2 ถ้วย ต้องการผสมน้ำ 6 ถ้วย อัตราส่วนน้ำเชื่อม:น้ำ = 1:3 ต้องใช้น้ำเชื่อมกี่ถ้วย? 🥤",
            "emoji_counter": {
                "items_before": "🧃🧃",
                "items_added": "💧💧💧 × 3",
                "question": "อัตราส่วน 1:3 กับน้ำเชื่อม 2 ถ้วย ต้องใช้น้ำกี่ถ้วย?"
            },
            "model": {
                "type": "graph_visual",
                "title": "🟦 ลองใช้ Model",
                "content": "วาดแผนภูมิแสดงอัตราส่วน"
            },
            "step_cards": ["อัตราส่วน 1:3", "น้ำเชื่อม 2 ถ้วย = 2 × 1 = 2 ส่วน", "น้ำ 3 ส่วน × 2 = 6 ถ้วย", "ใช้น้ำ 6 ถ้วย"],
            "number_sentence": "1:3 = 2:x → x = 2 × 3 = 6",
            "worked_example": {
                "question_th": "อัตราส่วนน้ำเชื่อม:น้ำ = 1:3 ถ้าใช้น้ำเชื่อม 3 ถ้วย ต้องใช้น้ำกี่ถ้วย?",
                "solution_steps": ["อัตราส่วน 1:3", "น้ำเชื่อม 3 ถ้วย = 3 × 1 ส่วน", "น้ำ = 3 × 3 = 9 ถ้วย"],
                "answer_th": "9 ถ้วย"
            },
            "common_mistakes": ["คูณผิด ทำให้อัตราส่วนผิด", "สลับลำดับอัตราส่วน", "ไม่คูณทั้งสองส่วน"],
            "mini_quiz": {
                "question": "อัตราส่วน 2:5 ถ้าใช้ส่วนแรก 4 ต้องใช้ส่วนที่สองเท่าไหร่?",
                "choices": ["8", "10", "12", "14"],
                "answer": "10",
                "explanation": "2:5 = 4:x → x = 4 × 5/2 = 10"
            }
        },
        "g6_volume": {
            "story_intro": f"ที่{emoji} {theme} มีกล่องทรงลูกบาศก์ ด้านละ 5 เซนติเมตร อยากรู้ว่ากล่องนี้จุของได้กี่ลูกบาศก์เซนติเมตร? 📦",
            "emoji_counter": {
                "items_before": "📐" * 5,
                "items_added": "📐³",
                "question": "ทรงลูกบาศก์ด้าน 5 ซม. มีปริมาตรเท่าไหร่?"
            },
            "model": {
                "type": "volume_visual",
                "title": "🟦 ลองใช้ Model",
                "content": "วาดทรงลูกบาศก์ แสดงด้านกว้าง ยาว สูง"
            },
            "step_cards": ["รู้ด้าน = 5 ซม.", "ทรงลูกบาศก์: กว้าง × ยาว × สูง", "แทนค่า: 5 × 5 × 5", "ปริมาตร = 125 ลูกบาศก์เซนติเมตร"],
            "number_sentence": "V = 5 × 5 × 5 = 125 ซม.³",
            "worked_example": {
                "question_th": "ทรงลูกบาศก์ด้าน 6 ซม. มีปริมาตรเท่าไหร่?",
                "solution_steps": ["ใช้สูตร: ด้าน × ด้าน × ด้าน", "แทนค่า: 6 × 6 × 6", "คูณ: 6 × 6 = 36, 36 × 6 = 216"],
                "answer_th": "216 ลูกบาศก์เซนติเมตร"
            },
            "common_mistakes": ["ยกกำลังสองแทนยกกำลังสาม", "ลืมใช้หน่วยลูกบาศก์", "คูณด้านผิด"],
            "mini_quiz": {
                "question": "ทรงลูกบาศก์ด้าน 4 ซม. มีปริมาตรเท่าไหร่?",
                "choices": ["12 ซม.³", "16 ซม.³", "64 ซม.³", "96 ซม.³"],
                "answer": "64 ซม.³",
                "explanation": "V = 4 × 4 × 4 = 64 ซม.³"
            }
        }
    }
    
    return contents.get(lesson_id, contents["g6_equations_intro"])

def generate_variants(lesson_id, themes_th):
    """Generate 10 variants for a lesson."""
    variants = []
    
    for i in range(10):
        emoji, theme = STORY_THEMES[i]
        content = get_content_for_lesson(lesson_id, i)
        model_type = get_model_type(lesson_id)
        
        variant = {
            "variant_id": f"v{i+1:02d}",
            "variant_title_th": f"{emoji} {theme}",
            "story_theme_th": f"เรียนรู้เรื่อง{lesson_id.replace('g6_', '').replace('_', ' ')}ผ่านธีม{themes_th[i]}",
            "visual_blocks": [
                {
                    "type": "story_intro",
                    "title": "🐣 เรื่องราวชวนคิด",
                    "content": content["story_intro"]
                },
                {**content["emoji_counter"], "type": "emoji_counter"},
                {
                    "type": model_type,
                    "title": "🟦 ลองใช้ Model",
                    "content": content["model"]["content"]
                },
                {
                    "type": "step_cards",
                    "title": "📝 คิดทีละขั้น",
                    "steps": content["step_cards"]
                },
                {
                    "type": "number_sentence",
                    "title": "✍️ เขียนเป็นประโยคคณิต",
                    "expression": content["number_sentence"]
                },
                {
                    "type": "worked_example",
                    "title": "✅ ตัวอย่าง",
                    "question_th": content["worked_example"]["question_th"],
                    "solution_steps": content["worked_example"]["solution_steps"],
                    "answer_th": content["worked_example"]["answer_th"]
                },
                {
                    "type": "common_mistakes",
                    "title": "⚠️ ระวังจุดพลาด",
                    "items": content["common_mistakes"]
                },
                {
                    "type": "mini_quiz",
                    "title": "🎯 ลองทำดู",
                    "question": content["mini_quiz"]["question"],
                    "choices": content["mini_quiz"]["choices"],
                    "answer": content["mini_quiz"]["answer"],
                    "explanation": content["mini_quiz"]["explanation"]
                }
            ]
        }
        variants.append(variant)
    
    return variants

def main():
    themes_th = [t[1] for t in STORY_THEMES]
    
    for lesson_file in LESSON_FILES:
        file_path = os.path.join(LESSONS_DIR, f"{lesson_file}.json")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Generate variants
        variants = generate_variants(lesson_file, themes_th)
        
        # Add lesson_variants to data
        data["lesson_variants"] = variants
        
        # Save updated JSON
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"[OK] Updated {lesson_file}.json with {len(variants)} variants")

if __name__ == "__main__":
    main()
