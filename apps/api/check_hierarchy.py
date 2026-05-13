import json, re

# Check g4 file - find the structure path to mini_quiz
path = r'D:\web app\4-craft.com\apps\api\app\content\math\grade_4\lessons\g4_angles_geometry.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Find all mini_quiz occurrences
count = content.count('"type": "mini_quiz"')
print(f'Total mini_quiz occurrences: {count}')

# Get JSON structure to understand hierarchy
data = json.loads(content)
print('Keys at root:', list(data.keys()))

# Check structure
# lesson -> variants -> visual_blocks -> mini_quiz?
for key in data:
    if isinstance(data[key], list):
        print(f'{key}: list of {len(data[key])} items')
        if len(data[key]) > 0:
            print(f'  First item keys: {list(data[key][0].keys()) if isinstance(data[key][0], dict) else type(data[key][0])}')

# Find where mini_quiz lives
def find_path(obj, target, path=[]):
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_path = path + [k]
            if k == target:
                return new_path
            result = find_path(v, target, new_path)
            if result:
                return result
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            result = find_path(item, target, path + [f'[{i}]'])
            if result:
                return result
    return None

path_to_mini_quiz = find_path(data, 'mini_quiz')
print(f'Path to mini_quiz: {path_to_mini_quiz}')