"""Asset audit: cross-reference /brand/topa references in src/ against files on disk."""
import os
import re

ROOT = "public/brand/topa"
files = []
for dirpath, _dirnames, filenames in os.walk(ROOT):
    for name in filenames:
        path = os.path.join(dirpath, name).replace(os.sep, "/")
        files.append(path)

sources = []
for dirpath, _dirnames, filenames in os.walk("src"):
    for name in filenames:
        if name.endswith((".ts", ".tsx")):
            sources.append(os.path.join(dirpath, name).replace(os.sep, "/"))

pattern = re.compile(r"['\"`](/brand/topa/[^'\"`?#\s]+)")
dynamic_pattern = re.compile(r"['\"`](/brand/topa/[^'\"`]*?)['\"`]\s*\+")
refs = {}
for src in sources:
    text = open(src, encoding="utf-8", errors="ignore").read()
    # Strip comments so historical/removed paths mentioned in explanatory
    # comments are not reported as live references.
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"//.*$", "", text, flags=re.M)
    for match in pattern.findall(text):
        refs.setdefault(match, set()).add(src)
    # Template-literal concatenation, e.g. `/brand/topa/${x}.png`
    for match in dynamic_pattern.findall(text):
        refs.setdefault(match, set()).add(src)

referenced_dirs = {ref for ref in refs if ref.endswith("/")}

print("total files on disk:", len(files))
print()
print("=== REFERENCED IN src/ BUT MISSING ON DISK ===")
missing = []
for ref in sorted(refs):
    if ref.endswith("/"):
        continue
    if not os.path.exists("public" + ref):
        missing.append(ref)
        print(ref, "<-", sorted(refs[ref]))
print("(count:", len(missing), ")")

print()
print("=== ON DISK BUT NOT REFERENCED IN src/ ===")
unref = []
for path in sorted(files):
    if path.endswith(".bak-phase0"):
        continue
    public_path = "/" + path[len("public"):]
    directory = public_path.rsplit("/", 1)[0] + "/"
    if public_path in refs or directory in referenced_dirs:
        continue
    unref.append(path)
for path in unref:
    print(path)
print("(count:", len(unref), ")")

print()
total = sum(os.path.getsize(f) for f in files if not f.endswith(".bak-phase0"))
print("total brand asset bytes:", total, "=", round(total / 1024 / 1024, 2), "MB")

print()
print("=== LARGEST FILES (>150KB) ===")
for path in sorted(files):
    if path.endswith(".bak-phase0"):
        continue
    size = os.path.getsize(path)
    if size > 150 * 1024:
        print(f"{size:>8} bytes  {path}")
