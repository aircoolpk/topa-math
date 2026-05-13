#!/usr/bin/env python3
"""Fix Schema B mini_quiz in grade_2 files.
The problem: "explanation_th" is placed inside "data" object instead of at mini_quiz level.
Also "answer" needs to become "correct_answer".

Current broken structure (at mini_quiz block level):
  "data": {
    "questions": [
      {"text_th": "...", "choices": [...], "answer": "..."},
      ...
    ]
                                                          "explanation_th": "..."}

Should be:
  "data": {
    "questions": [...]
  },
  "explanation_th": "..."
}
"""
import os
import re

GRADE2_LESSONS = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_2\lessons'
THAI_EXPLANATION = 'ดูตัวอย่างในบทเรียนเพื่อหาคำตอบที่ถูกต้อง'

files = [
    'g2_add_two_digit.json',
    'g2_money_change.json',
    'g2_multiplication_intro.json',
    'g2_shapes_2d.json',
    'g2_subtract_two_digit.json',
    'g2_times_table_2_5_10.json',
    'g2_time_calendar.json',
]

for fname in files:
    fpath = os.path.join(GRADE2_LESSONS, fname)
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    original = content
    
    # Fix 1: "answer" -> "correct_answer" in questions that have choices
    # Pattern: "text_th": "...", "choices": [...], "answer": "VALUE"
    pattern1 = r'("text_th"\s*:\s*"[^"]+"\s*,\s*"choices"\s*:\s*\[[^\]]+\]\s*,\s*)"answer"(\s*:\s*)"([^"]+)("'
    replacement1 = r'\1"correct_answer"\2"\3\4'
    content = re.sub(pattern1, replacement1, content)
    
    # Fix 2: explanation_th inside data (wrong position) -> properly placed at mini_quiz level
    # The bad pattern: ]\s+\n\s+"explanation_th": "..."    }\n  }\n}
    # After closing questions array ], there's no }, to close data
    # explanation_th is at deep indentation inside data
    # The closing } of mini_quiz comes after explanation_th's }
    
    # Pattern: after ] (closing questions), there's whitespace then "explanation_th" with lots of trailing spaces then }
    # We need to: close data with }, move explanation_th to proper position
    
    # The bad pattern is:
    # ]          \n                                                          "explanation_th": "..."     }\n        }\n      }
    # Where } after explanation_th closes something, then } after that closes mini_quiz
    
    # Correct pattern should be:
    # ],\n        },\n        "explanation_th": "...",\n      }
    # Wait - looking at the structure again:
    # "data": {  <- opens
    #   "questions": [...]
    #   <- missing } to close data
    #   "explanation_th": "..."  <- this is at data level (wrong) 
    # }
    # So we need to: insert } after ], then fix explanation_th position
    
    # Actually looking at last 800 chars:
    # "questions": [...]\n            ]\n          \n               "explanation_th": "..."}
    # The closing } after explanation_th is at the same indentation as explanation_th, which means it's closing mini_quiz
    # But data never got a closing }
    
    # So: data is missing its }, explanation_th is inside data
    # Fix: after ] add } to close data, then explanation_th stays at data level but needs comma after its },
    # Wait no - the schema shows explanation_th at mini_quiz level, not data level
    
    # From valid_block.txt (grade_4):
    # "data": { content: { questions: [...] } }
    # There's no explanation_th at all in grade_4 mini_quiz!
    # Wait, let me check again...
    
    # Actually looking at broken_block.txt:
    # "data": {
    #   "questions": [...]
    #   <- no closing } for data
    #   "explanation_th": "..."   <- at data level
    # }
    # So data never closes, explanation_th is inside data
    
    # Fix: Insert } after ] (to close data), keep explanation_th at data level but add comma
    # Then later } closes mini_quiz
    
    # Pattern to find: ]\s+\n\s+"explanation_th": "VALUE" followed by whitespace and }
    # We need: ]\n        },\n        "explanation_th": "VALUE",\n      }
    
    # Let me be very specific about what to replace:
    # Bad: ]          \n                                                          "explanation_th": "See correct answer above"                                                 }\n        }\n      }
    # Good: ]\n        },\n        "explanation_th": "THAI",\n      }
    
    # The ] has 12 spaces (3 tabs), then 10 spaces before explanation_th
    # The } after explanation_th has lots of trailing spaces
    
    # Match: ] + whitespace + "explanation_th": "...", then spaces + }
    # The pattern: (\])\s+(\n\s+)("explanation_th":\s*"[^"]+")\s+(\})
    # Replace with: \1\2},\n        \3",\n      }
    
    p = r'(\])\s+(\n\s+)("explanation_th":\s*"[^"]+")\s+(\})'
    fixed = re.sub(p, r'\1\2},\n        \3",\n      }', content)
    content = fixed
    
    if content != original:
        with open(fpath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print(f'{fname}: Fixed')
    else:
        print(f'{fname}: No changes')

print('Done!')