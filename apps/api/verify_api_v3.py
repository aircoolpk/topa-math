import urllib.request, json, sys
sys.stdout.reconfigure(encoding='utf-8')

req = urllib.request.Request('http://localhost:8001/auth/login',
    data=json.dumps({'email': 'demo@4-craft.com', 'password': 'demo1234'}).encode(),
    headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())['access_token']
print('Login OK')

headers = {'Authorization': f'Bearer {token}'}
lessons = ['g3_area_intro', 'g3_division_intro', 'g3_fractions_intro']
for lid in lessons:
    req = urllib.request.Request(f'http://localhost:8001/me/lessons/{lid}', headers=headers)
    r = urllib.request.urlopen(req)
    data = json.loads(r.read())
    blocks = data.get('visual_blocks', [])
    print(f'\n=== {lid} ===')
    for b in blocks:
        bt = b.get('type')
        if bt == 'mini_quiz':
            ca = b.get('correct_answer')
            ans = b.get('answer')
            ch = b.get('choices')
            et = b.get('explanation_th')
            print(f'  mini_quiz: correct_answer={ca} answer={ans}')
            print(f'  choices={ch}')
            print(f'  explanation_th={et[:80] if et else None}')
        else:
            print(f'  {bt}')