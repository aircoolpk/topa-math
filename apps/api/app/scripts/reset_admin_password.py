from __future__ import annotations

import argparse

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset an existing admin user's password safely.")
    parser.add_argument("email", help="Email address to promote and reset")
    parser.add_argument("temporary_password", help="Temporary password to hash and store")
    args = parser.parse_args()

    email = args.email.strip().lower()
    if not email:
        raise SystemExit("Email is required")
    if len(args.temporary_password) < 8:
        raise SystemExit("Temporary password must be at least 8 characters")

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        created = user is None
        if not user:
            user = User(email=email, password_hash=hash_password(args.temporary_password))
            db.add(user)
        else:
            user.password_hash = hash_password(args.temporary_password)

        if hasattr(user, "role"):
            user.role = "admin"
        if hasattr(user, "is_active"):
            user.is_active = True
        if hasattr(user, "email_verified"):
            user.email_verified = True

        db.commit()
        action = "created" if created else "updated"
        print(f"Admin login reset complete for {user.email} ({action})")


if __name__ == "__main__":
    main()
