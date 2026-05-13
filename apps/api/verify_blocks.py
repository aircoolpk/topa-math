import urllib.request, json, sys
sys.stdout.reconfigure(encoding='utf-8')
req = urllib.request.Request('http://localhost:8001/auth/login',
    data=json.dumps({'email': 'demo@4-craft.com', 'password': 'demo1234'}).encode(),
    headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())['access_token']
headers_auth = {'Authorization': f'Bearer {token}'}

for lid in ['g3_area_intro', 'g3_division_intro', 'g3_fractions_intro']:
    req = urllib.request.Request(f'http://localhost:8001/me/lessons/{lid}', headers=headers_auth)
    r = urllib.request.urlopen(req)
    data = json.loads(r.read())
    blocks = data.get('visual_blocks', [])
    block_types = [b.get('type') for b in blocks]
    print(f'{lid}: {block_types}')
    for b in blocks:
        if b.get('type') == 'mini_quiz':
            d = b.get('data', {})
            ca = d.get('correct_answer')
            ans = d.get('answer')
            et = d.get('explanation_th')
            print(f'  correct_answer={ca} answer={ans}')
            print(f'  explanation_th={et}')