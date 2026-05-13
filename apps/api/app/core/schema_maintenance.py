from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


CHILD_PROFILE_COLUMNS = {
    "parent_user_id": "VARCHAR(36)",
    "first_name": "VARCHAR(80)",
    "last_name": "VARCHAR(80)",
    "nickname": "VARCHAR(80)",
    "grade_level": "INTEGER DEFAULT 1",
    "province": "VARCHAR(120)",
    "district": "VARCHAR(120)",
    "school_name": "VARCHAR(180)",
    "school_province": "VARCHAR(120)",
    "school_district": "VARCHAR(120)",
    "student_photo_url": "TEXT",
    "student_photo_path": "TEXT",
    "avatar_gender": "VARCHAR(20)",
    "avatar_config": "JSON DEFAULT '{}'",
    "program_type": "VARCHAR(10) DEFAULT 'THP'",
    "membership_status": "VARCHAR(20) DEFAULT 'free'",
    "stripe_customer_id": "VARCHAR(255)",
    "stripe_subscription_id": "VARCHAR(255)",
    "subscription_status": "VARCHAR(40) DEFAULT 'none'",
    "current_period_end": "DATETIME",
    "access_ends_at": "DATETIME",
    "plan_code": "VARCHAR(40) DEFAULT 'free'",
    "plan_type": "VARCHAR(40) DEFAULT 'free'",
    "active_price_code": "VARCHAR(80)",
    "price_type": "VARCHAR(40)",
    "billing_program_type": "VARCHAR(10)",
    "admin_note": "TEXT",
    "manual_grant_reason": "VARCHAR(120)",
    "paid_at": "DATETIME",
    "canceled_at": "DATETIME",
    "cancel_at_period_end": "BOOLEAN DEFAULT 0",
    "total_score": "INTEGER DEFAULT 0",
    "total_xp": "INTEGER DEFAULT 0",
    "coins": "INTEGER DEFAULT 0",
    "current_level": "INTEGER DEFAULT 1",
    "days_active": "INTEGER DEFAULT 0",
    "test_attempts_used": "INTEGER DEFAULT 0",
    "free_test_limit": "INTEGER DEFAULT 5",
    "total_tests_completed": "INTEGER DEFAULT 0",
    "average_test_accuracy": "NUMERIC(5, 2) DEFAULT 0",
    "average_test_speed": "NUMERIC(10, 2) DEFAULT 0",
    "current_rank_title": "VARCHAR(80) DEFAULT 'Beginner'",
    "streak_count": "INTEGER DEFAULT 0",
    "last_active_date": "DATE",
}

CHILD_QUEST_COLUMNS = {
    "recurrence_type": "VARCHAR(20) DEFAULT 'none'",
    "period_key": "VARCHAR(40)",
    "progress_current": "INTEGER DEFAULT 0",
    "progress_target": "INTEGER DEFAULT 1",
    "score_awarded": "INTEGER DEFAULT 0",
}

TEST_RESULT_COLUMNS = {
    "total_time_ms": "INTEGER DEFAULT 0",
}

TEST_SESSION_COLUMNS = {
    "metadata": "JSON DEFAULT '{}'",
}

QUIZ_ANSWER_COLUMNS = {
    "selected_answer_raw": "TEXT",
    "selected_answer_normalized": "TEXT",
    "correct_answer_normalized": "TEXT",
}

CREATE_TABLES = [
    """
    CREATE TABLE IF NOT EXISTS lesson_variant_views (
        id VARCHAR(36) PRIMARY KEY,
        child_id VARCHAR(36),
        lesson_id VARCHAR(120),
        variant_id VARCHAR(80),
        cycle_number INTEGER DEFAULT 1,
        viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS question_attempt_history (
        id VARCHAR(36) PRIMARY KEY,
        child_id VARCHAR(36),
        question_id VARCHAR(36),
        lesson_id VARCHAR(120),
        grade_level INTEGER,
        topic_code VARCHAR(120),
        skill_code VARCHAR(120),
        question_type VARCHAR(20) DEFAULT 'core',
        rotation_scope VARCHAR(40),
        rotation_key VARCHAR(160),
        cycle_number INTEGER DEFAULT 1,
        first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        attempt_count INTEGER DEFAULT 0,
        last_is_correct BOOLEAN
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        action VARCHAR(80),
        target_user_id VARCHAR(36),
        old_value JSON DEFAULT '{}',
        new_value JSON DEFAULT '{}',
        changed_by_admin_id VARCHAR(36),
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """,
]


def ensure_local_schema(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    missing_by_table: dict[str, dict[str, str]] = {}
    if "child_profiles" in table_names:
        existing_columns = {column["name"] for column in inspector.get_columns("child_profiles")}
        missing_by_table["child_profiles"] = {
            column_name: column_type
            for column_name, column_type in CHILD_PROFILE_COLUMNS.items()
            if column_name not in existing_columns
        }
    if "child_quests" in table_names:
        existing_columns = {column["name"] for column in inspector.get_columns("child_quests")}
        missing_by_table["child_quests"] = {
            column_name: column_type
            for column_name, column_type in CHILD_QUEST_COLUMNS.items()
            if column_name not in existing_columns
        }
    if "test_results" in table_names:
        existing_columns = {column["name"] for column in inspector.get_columns("test_results")}
        missing_by_table["test_results"] = {
            column_name: column_type
            for column_name, column_type in TEST_RESULT_COLUMNS.items()
            if column_name not in existing_columns
        }
    if "test_sessions" in table_names:
        existing_columns = {column["name"] for column in inspector.get_columns("test_sessions")}
        missing_by_table["test_sessions"] = {
            column_name: column_type
            for column_name, column_type in TEST_SESSION_COLUMNS.items()
            if column_name not in existing_columns
        }
    if "quiz_answers" in table_names:
        existing_columns = {column["name"] for column in inspector.get_columns("quiz_answers")}
        missing_by_table["quiz_answers"] = {
            column_name: column_type
            for column_name, column_type in QUIZ_ANSWER_COLUMNS.items()
            if column_name not in existing_columns
        }
    with engine.begin() as connection:
        for create_table_sql in CREATE_TABLES:
            connection.execute(text(create_table_sql))
        for table_name, missing_columns in missing_by_table.items():
            for column_name, column_type in missing_columns.items():
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
