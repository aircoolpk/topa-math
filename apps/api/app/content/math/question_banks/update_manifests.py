#!/usr/bin/env python3
"""Generate question_banks_manifest.json for each grade"""
import pathlib, json

base = pathlib.Path(r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks')

for g in [1,2,3,4,5,6]:
    d = base / f'grade_{g}'
    files = sorted(d.glob('*.jsonl'))
    topics = []
    for f in files:
        name = f.stem  # e.g., 'g1_counting_20'
        # Count lines
        lines = sum(1 for _ in open(f, encoding='utf-8', errors='replace') if _.strip())
        topics.append({
            'topic_code': name,
            'file': f'{name}.jsonl',
            'question_count': lines,
            'status': 'generated'
        })
    manifest = {
        'grade': g,
        'topics': topics,
        'total_questions': sum(t['question_count'] for t in topics)
    }
    out = d / 'manifest.json'
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f'Grade {g}: {len(topics)} topics, {manifest["total_questions"]} total questions')

print('All manifests written')