FROM python:3.12-slim
ARG RELEASE_REVISION=unversioned
LABEL org.opencontainers.image.revision=$RELEASE_REVISION
ENV RELEASE_REVISION=$RELEASE_REVISION

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

COPY pyproject.toml ./
COPY alembic.ini ./
COPY alembic ./alembic
# Application code AND canonical lesson/site content.
# Content is baked into the image on purpose: the container must resolve
# content/math (grade_N/lessons/{TH,EP}) + content/site (homepage.json)
# even where host bind mounts are unavailable (Cloudflare Containers, CI).
COPY app ./app

RUN pip install --upgrade pip \
    && pip install .

# Keep a single source of truth: drop the pip-installed duplicate of the app
# package so `import app` always resolves to /app/app (where the content lives).
RUN rm -rf /usr/local/lib/python*/site-packages/app

# Fail the build early if canonical content is missing or still in the legacy
# grade_N/{curriculum.json,lessons/} layout instead of grade_N/lessons/{TH,EP}.
RUN python -c "import pathlib,sys; c=pathlib.Path('/app/app/content'); need=[c/'site'/'homepage.json',c/'math'/'grade_3'/'lessons'/'TH',c/'math'/'grade_3'/'lessons'/'EP',c/'math'/'curriculum'/'grade_3'/'curriculum_map.json']; missing=[str(p) for p in need if not p.exists()]; sys.exit('missing canonical content: '+', '.join(missing)) if missing else print('content layout OK:', sorted(p.name for p in (c/'math').iterdir() if p.is_dir()))"

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
