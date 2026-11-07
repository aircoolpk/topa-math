#!/usr/bin/env bash
# Restart the TOPA Math API container with the correct env file.
# This fixes the "password authentication failed" issue when running
# `docker compose up -d` without --env-file.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Stopping 4craft-api..."
docker stop 4craft-api || true

echo "→ Removing 4craft-api container..."
docker rm -f 4craft-api || true

echo "→ Starting 4craft-api with .env.docker..."
docker compose -f docker-compose.beta.yml --env-file .env.docker up -d 4craft-api

echo "→ Waiting 5s for API to come up..."
sleep 5

echo "→ Health check..."
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep -E '4craft-(api|web|postgres|redis)'

echo ""
echo "✓ Done. Check logs with: docker logs 4craft-api --tail 30"
echo "✓ Test endpoint:       curl http://localhost:8001/health"
