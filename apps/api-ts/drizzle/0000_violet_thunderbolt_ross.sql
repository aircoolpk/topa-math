CREATE TABLE "admin_audit_logs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"action" varchar(80) NOT NULL,
	"target_user_id" varchar(36),
	"old_value" jsonb,
	"new_value" jsonb,
	"changed_by_admin_id" varchar(36),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "affiliate_commission_ledger" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"affiliate_user_id" varchar(36) NOT NULL,
	"referred_user_id" varchar(36) NOT NULL,
	"payment_reference_id" varchar(160) NOT NULL,
	"source_event_id" varchar(160) NOT NULL,
	"amount_paid_minor" integer NOT NULL,
	"commission_minor" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"rate_bps" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"available_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"withdrawal_request_id" varchar(36),
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "affiliate_payout_accounts" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"payout_method" varchar(20) NOT NULL,
	"account_holder_name" varchar(160) NOT NULL,
	"bank_name" varchar(120),
	"account_last4" varchar(8),
	"promptpay_last4" varchar(8),
	"payout_details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "affiliate_withdrawal_requests" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"payout_account_id" varchar(36) NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(30) NOT NULL,
	"reviewed_by_admin_id" varchar(36),
	"admin_note" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_generation_jobs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"skill_id" varchar(36) NOT NULL,
	"job_type" varchar(80) NOT NULL,
	"input_payload" jsonb NOT NULL,
	"output_payload" jsonb,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "avatar_items" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"item_type" varchar(40) NOT NULL,
	"rarity" varchar(40) DEFAULT 'common',
	"asset_url" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"icon_url" text
);
--> statement-breakpoint
CREATE TABLE "check_in_events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"event_date" date NOT NULL,
	"period_day" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "child_badges" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"badge_id" varchar(36) NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "child_inventory" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"avatar_item_id" varchar(36) NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "child_profiles" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"parent_user_id" varchar(36) NOT NULL,
	"first_name" varchar(80),
	"last_name" varchar(80),
	"nickname" varchar(80) NOT NULL,
	"grade_level" integer NOT NULL,
	"province" varchar(120),
	"district" varchar(120),
	"school_name" varchar(180),
	"school_province" varchar(120),
	"school_district" varchar(120),
	"student_photo_url" text,
	"student_photo_path" text,
	"avatar_gender" varchar(20),
	"avatar_config" jsonb DEFAULT '{}'::jsonb,
	"program_type" varchar(10) DEFAULT 'THP',
	"membership_status" varchar(20) DEFAULT 'free',
	"membership_provider" varchar(20),
	"mpp_access_ends_at" timestamp with time zone,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"subscription_status" varchar(40) DEFAULT 'none',
	"current_period_end" timestamp with time zone,
	"access_ends_at" timestamp with time zone,
	"plan_code" varchar(40) DEFAULT 'free',
	"plan_type" varchar(40) DEFAULT 'free',
	"active_price_code" varchar(80),
	"price_type" varchar(40),
	"billing_program_type" varchar(10),
	"admin_note" text,
	"manual_grant_reason" varchar(120),
	"paid_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false,
	"total_score" integer DEFAULT 0,
	"total_xp" integer DEFAULT 0,
	"coins" integer DEFAULT 0,
	"current_level" integer DEFAULT 1,
	"days_active" integer DEFAULT 0,
	"test_attempts_used" integer DEFAULT 0,
	"free_test_limit" integer DEFAULT 5,
	"total_tests_completed" integer DEFAULT 0,
	"average_test_accuracy" numeric(5, 2) DEFAULT '0',
	"average_test_speed" numeric(10, 2) DEFAULT '0',
	"current_rank_title" varchar(80) DEFAULT 'เด็กหลังห้อง',
	"streak_count" integer DEFAULT 0,
	"last_active_date" date,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "child_quests" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"quest_id" varchar(36) NOT NULL,
	"recurrence_type" varchar(20) DEFAULT 'none',
	"period_key" varchar(40),
	"status" varchar(20) DEFAULT 'not_started',
	"progress_current" integer DEFAULT 0,
	"progress_target" integer DEFAULT 1,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"xp_awarded" integer DEFAULT 0,
	"coin_awarded" integer DEFAULT 0,
	"score_awarded" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "child_recurring_quests" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"recurring_quest_template_id" varchar(36) NOT NULL,
	"recurrence_type" varchar(20) NOT NULL,
	"period_key" varchar(40) NOT NULL,
	"status" varchar(20) NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"xp_awarded" integer NOT NULL,
	"coin_awarded" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coin_ledger" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"amount" integer NOT NULL,
	"type" varchar(60) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"reference_id" varchar(120),
	"activated_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_quests" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"quest_id" varchar(120) NOT NULL,
	"grade_level" integer NOT NULL,
	"skill_code" varchar(80),
	"title" varchar(180) NOT NULL,
	"description" text,
	"quest_type" varchar(40) DEFAULT 'lesson',
	"recurrence_type" varchar(20) DEFAULT 'none',
	"xp_reward" integer DEFAULT 0,
	"coin_reward" integer DEFAULT 0,
	"estimated_minutes" integer,
	"status" varchar(20) DEFAULT 'active',
	"lesson_id" varchar(36),
	"quiz_id" varchar(120),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lesson_access" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"lesson_id" varchar(36) NOT NULL,
	"access_type" varchar(20) NOT NULL,
	"is_locked" boolean NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lesson_activity" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"lesson_id" varchar(120) NOT NULL,
	"activity_type" varchar(40) DEFAULT 'started',
	"period_day" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lesson_variant_views" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_id" varchar(36) NOT NULL,
	"lesson_id" varchar(120) NOT NULL,
	"variant_id" varchar(80) NOT NULL,
	"cycle_number" integer NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"skill_id" varchar(36) NOT NULL,
	"title" varchar(180) NOT NULL,
	"content" jsonb NOT NULL,
	"source" varchar(20) DEFAULT 'human',
	"status" varchar(20) DEFAULT 'draft',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "public_shares" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"token" varchar(80) NOT NULL,
	"share_type" varchar(40) NOT NULL,
	"created_by_user_id" varchar(36),
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quest_templates" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"quest_id" varchar(120) NOT NULL,
	"grade_level" integer NOT NULL,
	"skill_code" varchar(80),
	"title" varchar(180) NOT NULL,
	"description" text,
	"quest_type" varchar(40) NOT NULL,
	"recurrence_type" varchar(20) NOT NULL,
	"xp_reward" integer NOT NULL,
	"coin_reward" integer NOT NULL,
	"estimated_minutes" integer,
	"status" varchar(20) NOT NULL,
	"lesson_id" varchar(36),
	"quiz_id" varchar(120),
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "question_attempt_history" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_id" varchar(36) NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"lesson_id" varchar(120),
	"grade_level" integer NOT NULL,
	"topic_code" varchar(120),
	"skill_code" varchar(120),
	"question_type" varchar(20) NOT NULL,
	"rotation_scope" varchar(40) NOT NULL,
	"rotation_key" varchar(160) NOT NULL,
	"cycle_number" integer NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_count" integer NOT NULL,
	"last_is_correct" boolean
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"skill_id" varchar(36) NOT NULL,
	"grade_level" integer NOT NULL,
	"question_type" varchar(40) NOT NULL,
	"difficulty" varchar(20) NOT NULL,
	"question_text" text NOT NULL,
	"choices" jsonb,
	"correct_answer" text NOT NULL,
	"explanation" text,
	"hint" text,
	"source" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"quiz_session_id" varchar(36) NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"skill_id" varchar(36) NOT NULL,
	"selected_answer" text,
	"selected_answer_raw" text,
	"selected_answer_normalized" text,
	"correct_answer_normalized" text,
	"is_correct" boolean NOT NULL,
	"response_time_ms" integer,
	"hint_used" boolean NOT NULL,
	"attempt_count" integer NOT NULL,
	"mistake_type" varchar(80),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quiz_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"subject_id" varchar(36) NOT NULL,
	"mode" varchar(40) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"total_questions" integer NOT NULL,
	"correct_count" integer NOT NULL,
	"total_xp_earned" integer NOT NULL,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rank_snapshots" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"subject_id" varchar(36) NOT NULL,
	"grade_level" integer NOT NULL,
	"province" varchar(120),
	"rank_scope" varchar(20) NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"period_start" date,
	"period_end" date,
	"mastery_points" numeric(8, 2) NOT NULL,
	"speed_points" numeric(8, 2) NOT NULL,
	"improvement_points" numeric(8, 2) NOT NULL,
	"rank_score" numeric(8, 2) NOT NULL,
	"rank_position" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rank_titles" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"title" varchar(80) NOT NULL,
	"min_score" integer DEFAULT 0,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "recurring_quest_templates" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"quest_id" varchar(120) NOT NULL,
	"recurrence_type" varchar(20) NOT NULL,
	"grade_level" integer NOT NULL,
	"skill_code" varchar(80),
	"title" varchar(180) NOT NULL,
	"description" text,
	"quest_type" varchar(40) NOT NULL,
	"xp_reward" integer NOT NULL,
	"coin_reward" integer NOT NULL,
	"estimated_minutes" integer,
	"status" varchar(20) NOT NULL,
	"lesson_id" varchar(36),
	"quiz_id" varchar(120),
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"referrer_user_id" varchar(36) NOT NULL,
	"referred_user_id" varchar(36),
	"referral_token" varchar(80) NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"share_token" varchar(80),
	"visitor_hash" varchar(96),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skill_mastery" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"skill_id" varchar(36) NOT NULL,
	"mastery_score" numeric(5, 2) DEFAULT '0',
	"mastery_level" varchar(40) DEFAULT 'needs_help',
	"last_practiced_at" timestamp with time zone,
	"correct_count" integer DEFAULT 0,
	"incorrect_count" integer DEFAULT 0,
	"avg_response_time_ms" integer,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"subject_id" varchar(36) NOT NULL,
	"grade_level" integer NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"prerequisite_skill_ids" jsonb DEFAULT '[]'::jsonb,
	"difficulty_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_stats" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"lessons_completed" integer DEFAULT 0,
	"tests_completed" integer DEFAULT 0,
	"quests_completed" integer DEFAULT 0,
	"checkins" integer DEFAULT 0,
	"perfect_tests" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"test_session_id" varchar(36) NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"lesson_id" varchar(36),
	"quiz_id" varchar(120),
	"total_questions" integer DEFAULT 0,
	"correct_count" integer DEFAULT 0,
	"accuracy" numeric(5, 2) DEFAULT '0',
	"average_response_time_ms" numeric(10, 2) DEFAULT '0',
	"total_time_ms" integer DEFAULT 0,
	"score_awarded" integer DEFAULT 0,
	"xp_awarded" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "test_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"lesson_id" varchar(36),
	"quiz_id" varchar(120),
	"question_ids" jsonb DEFAULT '[]'::jsonb,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"timer_seconds" integer DEFAULT 300,
	"status" varchar(20) DEFAULT 'in_progress',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(20) DEFAULT 'parent',
	"plan" varchar(40) DEFAULT 'free',
	"plan_expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp with time zone,
	"referral_token" varchar(80),
	"referred_by_user_id" varchar(36),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"child_profile_id" varchar(36) NOT NULL,
	"source_type" varchar(80) NOT NULL,
	"source_id" varchar(36),
	"xp_amount" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "ix_affiliate_commission_ledger_affiliate_user_id" ON "affiliate_commission_ledger" USING btree ("affiliate_user_id");--> statement-breakpoint
CREATE INDEX "ix_affiliate_payout_accounts_user_id" ON "affiliate_payout_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_affiliate_withdrawal_requests_user_id" ON "affiliate_withdrawal_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_ai_generation_jobs_child_profile_id" ON "ai_generation_jobs" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "badges_code_idx" ON "badges" USING btree ("code");--> statement-breakpoint
CREATE INDEX "check_in_events_child_profile_id_idx" ON "check_in_events" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "child_badges_child_profile_id_idx" ON "child_badges" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "child_inventory_child_profile_id_idx" ON "child_inventory" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "child_profiles_parent_user_id_idx" ON "child_profiles" USING btree ("parent_user_id");--> statement-breakpoint
CREATE INDEX "child_profiles_stripe_customer_id_idx" ON "child_profiles" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "child_profiles_stripe_subscription_id_idx" ON "child_profiles" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "child_quests_child_profile_id_idx" ON "child_quests" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "ix_child_recurring_quests_child_profile_id" ON "child_recurring_quests" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "coin_ledger_user_id_idx" ON "coin_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coin_ledger_type_idx" ON "coin_ledger" USING btree ("type");--> statement-breakpoint
CREATE INDEX "coin_ledger_status_idx" ON "coin_ledger" USING btree ("status");--> statement-breakpoint
CREATE INDEX "learning_quests_quest_id_idx" ON "learning_quests" USING btree ("quest_id");--> statement-breakpoint
CREATE INDEX "ix_lesson_access_child_profile_id" ON "lesson_access" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "lesson_activity_child_profile_id_idx" ON "lesson_activity" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "ix_lesson_variant_views_child_id" ON "lesson_variant_views" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "lessons_skill_id_idx" ON "lessons" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "ix_public_shares_token" ON "public_shares" USING btree ("token");--> statement-breakpoint
CREATE INDEX "ix_public_shares_share_type" ON "public_shares" USING btree ("share_type");--> statement-breakpoint
CREATE INDEX "ix_public_shares_created_by_user_id" ON "public_shares" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "ix_quest_templates_quest_id" ON "quest_templates" USING btree ("quest_id");--> statement-breakpoint
CREATE INDEX "ix_question_attempt_history_child_id" ON "question_attempt_history" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "ix_questions_skill_id" ON "questions" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "ix_quiz_answers_quiz_session_id" ON "quiz_answers" USING btree ("quiz_session_id");--> statement-breakpoint
CREATE INDEX "ix_quiz_answers_child_profile_id" ON "quiz_answers" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "ix_quiz_sessions_child_profile_id" ON "quiz_sessions" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "ix_rank_snapshots_child_profile_id" ON "rank_snapshots" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "ix_recurring_quest_templates_quest_id" ON "recurring_quest_templates" USING btree ("quest_id");--> statement-breakpoint
CREATE INDEX "referral_events_referrer_user_id_idx" ON "referral_events" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "skill_mastery_child_profile_id_idx" ON "skill_mastery" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "skills_code_idx" ON "skills" USING btree ("code");--> statement-breakpoint
CREATE INDEX "student_stats_child_profile_id_idx" ON "student_stats" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "test_results_child_profile_id_idx" ON "test_results" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "test_sessions_child_profile_id_idx" ON "test_sessions" USING btree ("child_profile_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_referral_token_idx" ON "users" USING btree ("referral_token");--> statement-breakpoint
CREATE INDEX "users_referred_by_user_id_idx" ON "users" USING btree ("referred_by_user_id");--> statement-breakpoint
CREATE INDEX "xp_events_child_profile_id_idx" ON "xp_events" USING btree ("child_profile_id");