import json

# Test on g2_add_two_digit.json - just show what the structure looks like
path = r'D:\web app\4-craft.com\apps\api\backup_miniquiz_round2\g2_add_two_digit.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Show the problematic section
idx = content.find('"explanation_th": "See correct answer above"')
start = max(0, idx - 200)
end = min(len(content), idx + 150)
print('Problematic section:')
print(repr(content[start:end]))
print()

# Show the ] before it
before_exp = content[:idx]
last_bracket = before_exp.rfind(']')
bracket_context = content[last_bracket:last_bracket+50]
print('Bracket context:')
print(repr(bracket_context))
print()

# What should it be?
print('Should be: ],\\n        },\\n        "explanation_th": "THAI",\\n      }')