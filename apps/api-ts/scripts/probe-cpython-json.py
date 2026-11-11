import json

cases = [
    '{"a": "x\ty"}',
    '{"a": "\\q"}',
    '{"a": "\\uZZZZ"}',
    '{"a":1}{"b":2}',
    '[1,2][3]',
    '{"a":01}',
    '{"a":1.5.5}',
    '  ',
    '\n',
    '{"a" : 1, "b" : 2}',
    '{"a": 1,, "b": 2}',
    '{"a": "b" "c": 1}',
    '[',
    ']',
    '{',
    '}',
    '"a"',
    'true',
    'nul',
    'tru',
    '01',
    '-',
    '1.',
    '1e',
    '{"a":1,}',
    '[1,]',
    '{"a":"\\ud800"}',
    '{"\\u0041": 1}',
    'Infinity',
    'NaN',
    '-Infinity',
    '{"a": 1} extra',
    '{"a": +1}',
    '{"a": .5}',
    '{"a": 1e5}',
    '{"a": 1E+5}',
    '{"a": -0}',
    '{"a": 00}',
]
for c in cases:
    try:
        v = json.loads(c)
        print(repr(c), '-> OK', repr(v))
    except json.JSONDecodeError as e:
        print(repr(c), '->', e.pos, repr(e.msg))
    except Exception as e:
        print(repr(c), '-> OTHER', type(e).__name__, e)
