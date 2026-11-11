"""Generate a corpus of malformed/edge-case JSON documents and record what CPython reports."""
import json

cases = [
    '{not json',
    '{',
    '}',
    '[',
    ']',
    '[]',
    'null',
    'true',
    'false',
    'undefined',
    'nul',
    'tru',
    '01',
    '-',
    '1.',
    '1e',
    '1e5',
    '1E+5',
    '-0',
    '00',
    '{"a":01}',
    '{"a":1.5.5}',
    '{"a":1.}',
    '{"a":1e}',
    '{"a":1,}',
    '{"a":1, }',
    '[1,]',
    '[1, ]',
    '{"a":1} {"b":2}',
    '{"a":1}extra',
    '[1,2][3]',
    '{"a" "b":1}',
    '{"a":1,, "b":2}',
    '{"a":1 "b":2}',
    '{"a":"x',
    '{"a":"x\\ty"}',
    '{"a":"\\q"}',
    '{"a":"\\uZZZZ"}',
    '{"a":"\\u00zz"}',
    '{"a":"b" "c":1}',
    '{"a":',
    '{"a":1',
    '{"a":1,',
    '  ',
    '\n',
    '\t{"a":1}',
    '{"thai":"แบบทดสอบ"}',
    '{"thai":"แบบทดสอบ",}',
    '{"a":"\\u0e2a"}',
    'NaN',
    'Infinity',
    '-Infinity',
    '{"a":Infinity}',
]

out = []
for text in cases:
    try:
        value = json.loads(text)
        out.append({"text": text, "ok": True, "value": repr(value)})
    except json.JSONDecodeError as exc:
        out.append({"text": text, "ok": False, "pos": exc.pos, "msg": exc.msg})
    except Exception as exc:  # pragma: no cover
        out.append({"text": text, "ok": False, "pos": -1, "msg": f"{type(exc).__name__}: {exc}"})

with open('apps/api-ts/tmp/json-corpus.json', 'w', encoding='utf-8') as handle:
    json.dump(out, handle, ensure_ascii=False, indent=1)

print(f"wrote {len(out)} cases")
