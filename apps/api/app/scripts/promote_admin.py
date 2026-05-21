from __future__ import annotations

import argparse

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import User


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote an existing user account to admin.")
    parser.add_argument("email", help="Email address to promote")
    args = parser.parse_args()

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == args.email.lower()))
        if not user:
            raise SystemExit(f"User not found: {args.email}")
        user.role = "admin"
        user.is_active = True
        db.commit()
        print(f"Promoted {user.email} to admin")


if __name__ == "__main__":
    main()
