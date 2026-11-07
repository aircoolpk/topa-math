"""Throwaway probe: measure dashboard section latency vs pool size / concurrency.

Run inside the API container:
    docker cp pooltest.py 4craft-api:/tmp/pooltest.py
    docker exec 4craft-api python /tmp/pooltest.py <pool_size>
"""
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.models import ChildProfile

POOL = int(sys.argv[1]) if len(sys.argv) > 1 else 5
CONC = int(sys.argv[2]) if len(sys.argv) > 2 else 20

url = get_settings().database_url
engine = create_engine(
    url,
    pool_size=POOL,
    max_overflow=POOL,
    pool_timeout=30,
    pool_pre_ping=True,
    pool_recycle=1800,
)
Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

db0 = Session()
child = db0.scalar(select(ChildProfile))
db0.close()


def work(_i):
    from app.routers.me import _dashboard_lessons

    t0 = time.time()
    db = Session()
    try:
        c = db.get(ChildProfile, child.id)
        _dashboard_lessons(db, c)
        return time.time() - t0
    finally:
        db.close()


for conc in (1, CONC):
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=conc) as ex:
        els = list(ex.map(work, range(conc)))
    print(
        f"pool={POOL:>3} conc={conc:>3}: wall={time.time() - t0:7.3f}s "
        f"min={min(els):6.3f}s max={max(els):6.3f}s median={statistics.median(els):6.3f}s"
    )
