#!/usr/bin/env python3
"""Fix mini_quiz Schema B structure in grade_2 files.
The problem: "explanation_th" is inside the "data" object instead of at mini_quiz level.
Also, the "data" object is missing its closing }.

Current (broken):
  "data": {
    "questions": [...]
            }
  "explanation_th": "..."

Should be:
  "data": {
    "questions": [...]
  },
  "explanation_th": "..."
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
    fixes = 0
    
    # The problematic pattern inside mini_quiz data block:
    # ] followed by whitespace+newlines then "explanation_th": "...THAI..." } with no closing } for data
    # We need to find where the questions array closes and insert }, and fix explanation_th position
    
    # Pattern: "questions": [...all questions...] followed by whitespace then "explanation_th" inside data
    # The fix: add },\n  before explanation_th to close data object, then add , after explanation_th's }
    
    # The pattern to find (inside mini_quiz block):
    # \],\s*"explanation_th": "THAI..."}
    # This means after ] there's no }, but directly "explanation_th" which is wrong
    
    # Count occurrences
    bad_pattern = r'\]\s+"explanation_th"\s*:\s*"([^"]+)"(\s+)\}'
    matches = list(re.finditer(bad_pattern, content))
    
    if matches:
        print(f'{fname}: {len(matches)} bad data.explanation_th patterns')
        
        # The fix: replace with ]},\n  "explanation_th": "$1"\n    }
        # Actually we need to move explanation_th out of data and put it at mini_quiz level
        # New pattern: ]},\n  "explanation_th": "$1"\n  },
        # But actually there's more structure - let me think...
        
        # The current structure is:
        # "questions": [ ... ],
        #           "explanation_th": "THAI" }
        # The " after THAI is followed by spaces then } which closes something
        
        # We need: "questions": [ ... ] },\n  "explanation_th": "THAI"\n}
        # This closes data with }, then explanation_th at mini_quiz level, then } for mini_quiz
        
        for m in matches:
            # Get the full context
            start = max(0, m.start() - 100)
            end = min(len(content), m.end() + 100)
            context = content[start:end]
            
            # Replace pattern: ]  "explanation_th": "THAI"    } 
            # with: ]\n  },\n  "explanation_th": "THAI"\n  }
            # But wait - the original had "explanation_th": "See correct answer above" with spaces
            # The Thai version is now "explanation_th": "THAI" followed by whitespace and }
            
            # Actually the issue is:
            # Current: ]  "explanation_th": "THAI"  (no comma, no closing brace for data)
            # Should be: ]\n  },\n  "explanation_th": "THAI"\n  },
            # (add } to close data, comma after explanation_th, then outer } for mini_quiz)
            
            # But there's more context - let's just fix the pattern by finding the exact sequence
            pass
        
        # Simple fix: find ]  "explanation_th" and insert },\n  before "explanation_th"
        # And add \n  after the final } to close mini_quiz properly
        fixed_content = content
        
        # Actually the safest approach:
        # 1. Find the pattern where questions array closes ] followed by whitespace and explanation_th
        # 2. Insert },\n  after ] (to close data object)
        # 3. Move explanation_th to be properly separated
        
        # Let me just do targeted replacements
        # Pattern: ]   "explanation_th": "THAI"   }
        # Replace with: ]\n  },\n  "explanation_th": "THAI"\n}
        
        # Find all ] followed by "explanation_th" with only whitespace between
        p = r'(\])\s+("explanation_th":\s*"[^"]+")(\s+)\}'
        while True:
            new_content = re.sub(p, r'\1\n  },\n  \2\n  },', fixed_content)
            if new_content == fixed_content:
                break
            fixed_content = new_content
        
        if fixed_content != content:
            content = fixed_content
            fixes += 1
        
        with open(fpath, 'w', encoding='utf-8-sig') as f:
            f.write(content)
        print(f'  Applied structural fixes')
    else:
        print(f'{fname}: No bad patterns found')
    
    print()

print('Done!')