# Reset Admin Password Report

Date: 2026-05-16

## Files Changed

- `apps/api/app/scripts/reset_admin_password.py`
- `docs/RESET_ADMIN_PASSWORD_REPORT.md`

## Auth/User Model Inspection

The FastAPI backend uses `apps/api/app/models/entities.py`.

The `User` model includes:

- `email`
- `password_hash`
- `role`
- `is_active`

Admin access expects `role` to be `admin` or `owner` in `apps/api/app/routers/deps.py`.

## Password Hashing

The script uses the existing backend utility:

```python
from app.core.security import hash_password
```

It stores only the generated password hash in `password_hash`. It does not print the password hash.

## Docker Command

Run this one-time command against the running API container:

```powershell
docker exec -it 4craft-api python -m app.scripts.reset_admin_password infomilliongarden@gmail.com admin1234
```

Expected success output:

```text
Password reset complete and admin access enabled for infomilliongarden@gmail.com
```

## Behavior

The script:

- Finds the existing user by email.
- Exits without creating a new user if the email is missing.
- Hashes the temporary password with the existing PBKDF2 helper.
- Sets `role = admin`.
- Sets `is_active = true`.
- Commits the update.
- Does not print the plain database hash or any secrets.

## Safety Notes

- Existing users are preserved.
- Stripe was not modified.
- `npm audit fix --force` was not run.
- Change the temporary password after the first successful admin login.
