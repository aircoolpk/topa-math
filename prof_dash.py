"""Throwaway probe: cProfile the dashboard request path inside the API container.

    docker cp prof_dash.py 4craft-api:/tmp/prof_dash.py
    docker exec 4craft-api python /tmp/prof_dash.py
"""
import cProfile
import io
import pstats
import time

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models import ChildProfile

db0 = SessionLocal()
child = db0.scalar(select(ChildProfile))
db0.close()
print("child:", child.id, "grade:", child.grade_level, "program:", child.program_type)


def run():
    db = SessionLocal()
    try:
        c = db.get(ChildProfile, child.id)
        from app.routers.me import _dashboard_lessons

        _dashboard_lessons(db, c)
    finally:
        db.close()


run()  # warm

pr = cProfile.Profile()
pr.enable()
run()
pr.disable()
s = io.StringIO()
ps = pstats.Stats(pr, stream=s).sort_stats("cumulative")
ps.print_stats(28)
out = s.getvalue()
print("\n".join(out.splitlines()[:48]))
