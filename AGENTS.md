# AGENTS.md

## Build Order

1. Backend API and data model first.
2. Mastery, ranking, AI validation, and avatar systems.
3. Frontend after core API behavior is stable.

## Conventions

- Keep child privacy strict: ranking responses use nickname only.
- AI-generated content starts as draft unless validated.
- Math answer checks should be deterministic whenever possible.
- Service logic must have unit tests before frontend depends on it.
- Use Thai child-friendly text for learner-facing seed content.
