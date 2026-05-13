import argparse
import json
from dataclasses import asdict, dataclass

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import ChildProfile, User
from app.services.foundation import is_paid, remaining_free_tests


@dataclass
class AccessState:
    email: str
    user_id: str
    child_id: str | None
    child_nickname: str | None
    grade_level: int | None
    program_type: str | None
    membership_status: str | None
    test_attempts_used: int | None
    free_test_limit: int | None
    remaining_free_tests: int | None
    is_paid: bool


def _state(user: User, child: ChildProfile | None) -> AccessState:
    return AccessState(
        email=user.email,
        user_id=user.id,
        child_id=child.id if child else None,
        child_nickname=child.nickname if child else None,
        grade_level=child.grade_level if child else None,
        program_type=child.program_type if child else None,
        membership_status=child.membership_status if child else None,
        test_attempts_used=child.test_attempts_used if child else None,
        free_test_limit=child.free_test_limit if child else None,
        remaining_free_tests=remaining_free_tests(child) if child else None,
        is_paid=is_paid(child) if child else False,
    )


def set_user_plus(email: str) -> tuple[AccessState, AccessState]:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            raise SystemExit(f"User not found: {email}")

        child = db.scalar(select(ChildProfile).where(ChildProfile.parent_user_id == user.id))
        if not child:
            raise SystemExit(f"Child profile not found for user: {email}")

        before = _state(user, child)
        child.membership_status = "paid"
        child.program_type = child.program_type or "THP"
        child.free_test_limit = max(child.free_test_limit or 0, 999999)
        child.test_attempts_used = 0
        db.commit()
        db.refresh(child)
        after = _state(user, child)
        return before, after


def main() -> None:
    parser = argparse.ArgumentParser(description="Set a local user child profile to Plus/Paid access.")
    parser.add_argument("--email", default="aircoolpk@gmail.com", help="Parent user email to update.")
    args = parser.parse_args()

    before, after = set_user_plus(args.email)
    print("Before:")
    print(json.dumps(asdict(before), ensure_ascii=True, indent=2))
    print("After:")
    print(json.dumps(asdict(after), ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
