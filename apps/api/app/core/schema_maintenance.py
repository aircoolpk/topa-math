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

USER_COLUMNS = {
    "plan": {
        "sqlite": "VARCHAR(40) DEFAULT 'free'",
        "postgresql": "VARCHAR(40) DEFAULT 'free'",
    },
    "plan_expires_at": {
        "sqlite": "DATETIME",
        "postgresql": "TIMESTAMP WITH TIME ZONE",
    },
    "is_active": {
        "sqlite": "BOOLEAN DEFAULT 1",
        "postgresql": "BOOLEAN DEFAULT TRUE",
    },
    "last_login_at": {
        "sqlite": "DATETIME",
        "postgresql": "TIMESTAMP WITH TIME ZONE",
    },
    "referral_token": {
        "sqlite": "VARCHAR(80)",
        "postgresql": "VARCHAR(80)",
    },
    "referred_by_user_id": {
        "sqlite": "VARCHAR(36)",
        "postgresql": "VARCHAR(36)",
    },
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

PUBLIC_SHARES_TABLES = {
    "sqlite": """
        CREATE TABLE IF NOT EXISTS public_shares (
            id VARCHAR(36) PRIMARY KEY,
            token VARCHAR(80) UNIQUE,
            share_type VARCHAR(40),
            created_by_user_id VARCHAR(36),
            data JSON DEFAULT '{}',
            expires_at DATETIME,
            revoked_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """,
    "postgresql": """
        CREATE TABLE IF NOT EXISTS public_shares (
            id VARCHAR(36) PRIMARY KEY,
            token VARCHAR(80) UNIQUE,
            share_type VARCHAR(40),
            created_by_user_id VARCHAR(36),
            data JSONB DEFAULT '{}',
            expires_at TIMESTAMP WITH TIME ZONE,
            revoked_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """,
}

REFERRAL_TABLES = {
    "sqlite": [
        """
        CREATE TABLE IF NOT EXISTS referral_events (
            id VARCHAR(36) PRIMARY KEY,
            referrer_user_id VARCHAR(36),
            referred_user_id VARCHAR(36),
            referral_token VARCHAR(80),
            event_type VARCHAR(40),
            share_token VARCHAR(80),
            visitor_hash VARCHAR(96),
            metadata JSON DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS coin_ledger (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36),
            amount INTEGER,
            type VARCHAR(60),
            status VARCHAR(20) DEFAULT 'pending',
            reference_id VARCHAR(120),
            activated_at DATETIME,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """,
    ],
    "postgresql": [
        """
        CREATE TABLE IF NOT EXISTS referral_events (
            id VARCHAR(36) PRIMARY KEY,
            referrer_user_id VARCHAR(36),
            referred_user_id VARCHAR(36),
            referral_token VARCHAR(80),
            event_type VARCHAR(40),
            share_token VARCHAR(80),
            visitor_hash VARCHAR(96),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS coin_ledger (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36),
            amount INTEGER,
            type VARCHAR(60),
            status VARCHAR(20) DEFAULT 'pending',
            reference_id VARCHAR(120),
            activated_at TIMESTAMP WITH TIME ZONE,
            note TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        """,
    ],
}

AFFILIATE_TABLES = {
    "sqlite": [
        """
        CREATE TABLE IF NOT EXISTS affiliate_payout_accounts (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) UNIQUE,
            payout_method VARCHAR(20),
            account_holder_name VARCHAR(160),
            bank_name VARCHAR(120),
            account_last4 VARCHAR(8),
            promptpay_last4 VARCHAR(8),
            payout_details JSON DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS affiliate_withdrawal_requests (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36),
            payout_account_id VARCHAR(36),
            amount_minor INTEGER,
            currency VARCHAR(3) DEFAULT 'THB',
            status VARCHAR(30) DEFAULT 'pending_review',
            reviewed_by_admin_id VARCHAR(36),
            admin_note TEXT,
            requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid_at DATETIME
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS affiliate_commission_ledger (
            id VARCHAR(36) PRIMARY KEY,
            affiliate_user_id VARCHAR(36),
            referred_user_id VARCHAR(36),
            payment_reference_id VARCHAR(160) UNIQUE,
            source_event_id VARCHAR(160),
            amount_paid_minor INTEGER,
            commission_minor INTEGER,
            currency VARCHAR(3) DEFAULT 'THB',
            rate_bps INTEGER,
            status VARCHAR(20) DEFAULT 'pending',
            available_at DATETIME,
            reversed_at DATETIME,
            withdrawal_request_id VARCHAR(36),
            metadata JSON DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """,
    ],
    "postgresql": [
        """
        CREATE TABLE IF NOT EXISTS affiliate_payout_accounts (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            payout_method VARCHAR(20),
            account_holder_name VARCHAR(160),
            bank_name VARCHAR(120),
            account_last4 VARCHAR(8),
            promptpay_last4 VARCHAR(8),
            payout_details JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS affiliate_withdrawal_requests (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
            payout_account_id VARCHAR(36) REFERENCES affiliate_payout_accounts(id),
            amount_minor INTEGER,
            currency VARCHAR(3) DEFAULT 'THB',
            status VARCHAR(30) DEFAULT 'pending_review',
            reviewed_by_admin_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
            admin_note TEXT,
            requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            paid_at TIMESTAMP WITH TIME ZONE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS affiliate_commission_ledger (
            id VARCHAR(36) PRIMARY KEY,
            affiliate_user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
            referred_user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
            payment_reference_id VARCHAR(160) UNIQUE,
            source_event_id VARCHAR(160),
            amount_paid_minor INTEGER,
            commission_minor INTEGER,
            currency VARCHAR(3) DEFAULT 'THB',
            rate_bps INTEGER,
            status VARCHAR(20) DEFAULT 'pending',
            available_at TIMESTAMP WITH TIME ZONE,
            reversed_at TIMESTAMP WITH TIME ZONE,
            withdrawal_request_id VARCHAR(36) REFERENCES affiliate_withdrawal_requests(id) ON DELETE SET NULL,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        """,
    ],
}


def ensure_local_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    dialect = engine.dialect.name

    missing_by_table: dict[str, dict[str, str]] = {}
    if "users" in table_names:
        existing_columns = {column["name"] for column in inspector.get_columns("users")}
        missing_by_table["users"] = {
            column_name: type_by_dialect.get(dialect, type_by_dialect["sqlite"])
            for column_name, type_by_dialect in USER_COLUMNS.items()
            if column_name not in existing_columns
        }
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
        if dialect == "sqlite":
            for create_table_sql in CREATE_TABLES:
                connection.execute(text(create_table_sql))
        if "public_shares" not in table_names:
            connection.execute(text(PUBLIC_SHARES_TABLES.get(dialect, PUBLIC_SHARES_TABLES["sqlite"])))
        for table_name, create_table_sql in zip(("referral_events", "coin_ledger"), REFERRAL_TABLES.get(dialect, REFERRAL_TABLES["sqlite"])):
            if table_name not in table_names:
                connection.execute(text(create_table_sql))
        for table_name, create_table_sql in zip(
            ("affiliate_payout_accounts", "affiliate_withdrawal_requests", "affiliate_commission_ledger"),
            AFFILIATE_TABLES.get(dialect, AFFILIATE_TABLES["sqlite"]),
        ):
            if table_name not in table_names:
                connection.execute(text(create_table_sql))
        for table_name, missing_columns in missing_by_table.items():
            for column_name, column_type in missing_columns.items():
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
