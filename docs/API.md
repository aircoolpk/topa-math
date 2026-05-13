# API Draft

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /children`
- `GET /children`
- `PATCH /children/{child_id}`
- Child profile payloads support optional `school_name`, `school_province`, and `school_district` for future school analytics. Public ranking responses must not expose school information.
- `GET /skills?subject=math&grade_level=1`
- `POST /children/{child_id}/placement/start`
- `POST /quiz-sessions/{session_id}/answer`
- `POST /quiz-sessions/{session_id}/complete`
- `POST /children/{child_id}/personalized-practice/generate`
- `GET /rankings`
- `GET /avatar/items`
- `GET /admin/generated-content`
