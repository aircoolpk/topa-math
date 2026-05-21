# CORS Beta Fix Report

Date: 2026-05-15

## Issue

`https://beta.topamath.com/register` called `https://api-beta.topamath.com/auth/register`, but browser preflight failed:

- `OPTIONS /auth/register` returned 400.
- No `Access-Control-Allow-Origin` header was present.

## Scope

Only CORS configuration was changed.

Not changed:

- Auth logic
- Register/login logic
- Stripe
- Quiz/test logic

## Files Checked

- `apps/api/.env`
- `apps/api/app/main.py`
- `apps/api/app/core/config.py`

## Fix

`apps/api/.env` had duplicate `CORS_ORIGINS` entries. It was corrected to a single explicit non-wildcard list:

```env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://beta.topamath.com
```

Confirmed backend CORS wiring:

- `app/main.py` uses `CORSMiddleware`.
- `allow_origins` reads from `settings.cors_origin_list`.
- `app/core/config.py` reads `cors_origins` from `CORS_ORIGINS` env and splits it into a list.
- No wildcard origin is configured.

## Backend Restart

The backend process on `127.0.0.1:8001` was reloaded after the env correction. One existing process tree resisted direct termination with access denied, but touching the config file triggered the live Uvicorn reload and the corrected CORS env took effect.

Health check after reload:

```json
{"status":"ok"}
```

## Validation

Preflight checks to `OPTIONS http://127.0.0.1:8001/auth/register`:

| Origin | Status | Access-Control-Allow-Origin |
| --- | ---: | --- |
| `https://beta.topamath.com` | 200 | `https://beta.topamath.com` |
| `http://localhost:3000` | 200 | `http://localhost:3000` |
| `http://127.0.0.1:3000` | 200 | `http://127.0.0.1:3000` |

Auth endpoint checks with `Origin: https://beta.topamath.com`:

| Endpoint | Status | CORS Header | Result |
| --- | ---: | --- | --- |
| `POST /auth/register` | 200 | `https://beta.topamath.com` | returned token |
| `POST /auth/login` | 200 | `https://beta.topamath.com` | returned token |

Config readback:

```text
['http://localhost:3000', 'http://127.0.0.1:3000', 'https://beta.topamath.com']
```

Wildcard check:

```text
False
```

## Result

Resolved for closed Beta CORS:

- `https://beta.topamath.com`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

Decision: CORS is ready for `beta.topamath.com` closed Beta traffic.
