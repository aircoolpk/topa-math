-- The uploaded student avatars.
--
-- The legacy FastAPI service writes the images to the local filesystem
-- (`storage/uploads/avatars`) and mounts that folder at `/storage/avatars`.
-- A Cloudflare Worker has no writable filesystem, so the bytes live in
-- Postgres instead and `GET /storage/avatars/{filename}` streams them from
-- here.
--
-- The `child_profiles.student_photo_path` column holds the file name, so the
-- two tables are joined by name.

CREATE TABLE IF NOT EXISTS avatar_files (
  filename text PRIMARY KEY,
  content_type text NOT NULL,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE avatar_files IS 'The uploaded student avatars; the file name matches child_profiles.student_photo_path.';
