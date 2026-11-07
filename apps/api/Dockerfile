FROM python:3.12-slim
ARG RELEASE_REVISION=unversioned
LABEL org.opencontainers.image.revision=$RELEASE_REVISION
ENV RELEASE_REVISION=$RELEASE_REVISION

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml ./
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN pip install --upgrade pip \
    && pip install .

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
