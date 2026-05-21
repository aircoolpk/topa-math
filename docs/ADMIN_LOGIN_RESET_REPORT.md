# Admin Login Reset Report

Date: 2026-05-16

## Target Account

- Email: `infomilliongarden@gmail.com`
- Temporary password: `admin1234`

## Implementation

Inspected:

- `apps/api/app/core/security.py`
- `apps/api/app/models/entities.py`
- `apps/api/app/schemas/api.py`

The backend uses `hash_password()` from `app.core.security`, which stores PBKDF2-SHA256 hashes in `password_hash`. The `User` model supports `role` and `is_active`. No `email_verified` field exists in the current model, so no email verification field was updated.

Updated:

- `apps/api/app/scripts/reset_admin_password.py`

Behavior:

- Finds the user by normalized email.
- Creates the user if missing.
- Stores only the hashed password.
- Sets `role = admin`.
- Sets `is_active = true`.
- Does not print the password hash.

## Docker Commands Used

Copied the updated script into the running API container:

```powershell
docker cp C:\web-app\4-craft.com\apps\api\app\scripts\reset_admin_password.py 4craft-api:/app/app/scripts/reset_admin_password.py
```

Applied the reset inside Docker:

```powershell
docker exec 4craft-api python -m app.scripts.reset_admin_password infomilliongarden@gmail.com admin1234
```

Result:

```text
Admin login reset complete for infomilliongarden@gmail.com (updated)
```

## Login Test

Command:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8001/auth/login -Method Post -ContentType "application/json" -Body '{"email":"infomilliongarden@gmail.com","password":"admin1234"}'
```

Result:

```text
Login succeeded. Backend returned a bearer access token.
```

Admin identity check:

```powershell
GET http://127.0.0.1:8001/auth/me
```

Result:

```json
{"email":"infomilliongarden@gmail.com","role":"admin"}
```

Actual verification output:

```json
{"token_received":true,"token_type":"bearer","email":"infomilliongarden@gmail.com","role":"admin"}
```

## Safety

- Plain text password was not stored.
- Password hash was not printed.
- Existing users were preserved.
- Demo login was not modified.
- Stripe was not modified.
- `npm audit fix --force` was not run.

## Final Result

Email `infomilliongarden@gmail.com` can login with temporary password `admin1234` and has admin role.
