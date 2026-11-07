"""Throwaway probe: measure content JSON read speed from the image layer vs a bind mount.

    docker cp mountbench.py 4craft-api:/tmp/mountbench.py
    docker exec 4craft-api python /tmp/mountbench.py
"""
import json
import time
from pathlib import Path

ROOT = Path("/app/app/content/math")


def bench(label, root, n=200):
    files = sorted(root.rglob("*.json"))[:n]
    if not files:
        print(f"{label}: no files")
        return
    t0 = time.perf_counter()
    for f in files:
        f.read_text(encoding="utf-8-sig")
    el = time.perf_counter() - t0
    print(
        f"{label}: {len(files)} files in {el:.3f}s "
        f"({el / len(files) * 1000:.3f} ms/file, {len(files) / el:.1f} files/s)"
    )


bench("image layer (overlayfs)", ROOT)
bench("image layer (overlayfs) - 2nd pass", ROOT)
