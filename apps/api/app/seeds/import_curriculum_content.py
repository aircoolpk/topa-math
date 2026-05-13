from sqlalchemy.orm import Session

from app.core.database import Base, engine
from app.core.schema_maintenance import ensure_local_schema
from app.seeds.import_content import CONTENT_ROOT, import_content


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_local_schema(engine)
    with Session(engine) as session:
        totals = import_content(session, CONTENT_ROOT)
    print(
        "Curriculum import complete: "
        f"{totals['grades']} grades, {totals['skills']} skills, {totals['lessons']} lessons, "
        f"{totals['questions']} starter questions, {totals['quests']} quests"
    )


if __name__ == "__main__":
    main()
