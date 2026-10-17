CREATE TYPE "public"."account_type" AS ENUM('TEMPORARY', 'LONG_TERM');--> statement-breakpoint
CREATE TYPE "public"."activity_event" AS ENUM('CANDIDATE_ADDED', 'CANDIDATE_EDITED', 'VOTER_APPROVED', 'VOTER_REJECTED', 'VOTER_REVOKED', 'TOKEN_REISSUED');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('FREE', 'PAY_PER_USE', 'PREMIUM');--> statement-breakpoint
CREATE TYPE "public"."results_visibility" AS ENUM('IMMEDIATE', 'CONCEALED');--> statement-breakpoint
CREATE TYPE "public"."station_mode" AS ENUM('PUBLIC_POLL', 'CLOSED_VOTE');--> statement-breakpoint
CREATE TYPE "public"."station_status" AS ENUM('DRAFT', 'REG_OPEN', 'REG_CLOSED', 'VOTE_OPEN', 'VOTE_CLOSED', 'ARCHIVED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"polling_station_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"event_type" "activity_event" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"cloudinary_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"polling_station_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cast_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"polling_station_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"candidate_id" uuid
);
--> statement-breakpoint
CREATE TABLE "device_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"polling_station_id" uuid NOT NULL,
	"client_device_uuid" uuid NOT NULL,
	"device_fingerprint_hash" varchar(128),
	"has_voted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"tx_ref" varchar(128) NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polling_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" varchar(32) NOT NULL,
	"host_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"mode" "station_mode" NOT NULL,
	"status" "station_status" DEFAULT 'DRAFT' NOT NULL,
	"results_visibility" "results_visibility" DEFAULT 'CONCEALED' NOT NULL,
	"allow_abstain" boolean DEFAULT false NOT NULL,
	"mobile_only" boolean DEFAULT false NOT NULL,
	"voter_cap" integer NOT NULL,
	"is_launched" boolean DEFAULT false NOT NULL,
	"reg_starts_at" timestamp with time zone,
	"reg_ends_at" timestamp with time zone,
	"vote_starts_at" timestamp with time zone,
	"vote_ends_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "polling_stations_voter_cap_check" CHECK ("polling_stations"."voter_cap" BETWEEN 2 AND 50000)
);
--> statement-breakpoint
CREATE TABLE "registered_voters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"polling_station_id" uuid NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"phone_number" varchar(32) NOT NULL,
	"approval_status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"registration_attempts" integer DEFAULT 0 NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"token_hash" varchar(128),
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"device_fingerprint_hash" varchar(128),
	"client_device_uuid" uuid,
	"ip_hash" varchar(128),
	"flag_reason" text,
	"has_voted" boolean DEFAULT false NOT NULL,
	"voted_at" timestamp with time zone,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	CONSTRAINT "registered_voters_voted_at_minute_precision_check" CHECK ("registered_voters"."voted_at" IS NULL OR EXTRACT(SECOND FROM "registered_voters"."voted_at") = 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(80) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"account_type" "account_type" NOT NULL,
	"plan" "plan" DEFAULT 'FREE' NOT NULL,
	"last_login_at" timestamp with time zone,
	"email_verified_at" timestamp with time zone,
	"purge_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_polling_station_id_polling_stations_id_fk" FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_polling_station_id_polling_stations_id_fk" FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cast_votes" ADD CONSTRAINT "cast_votes_polling_station_id_polling_stations_id_fk" FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cast_votes" ADD CONSTRAINT "cast_votes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cast_votes" ADD CONSTRAINT "cast_votes_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_records" ADD CONSTRAINT "device_records_polling_station_id_polling_stations_id_fk" FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polling_stations" ADD CONSTRAINT "polling_stations_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registered_voters" ADD CONSTRAINT "registered_voters_polling_station_id_polling_stations_id_fk" FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_records_station_client_uuid_unique" ON "device_records" USING btree ("polling_station_id","client_device_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_tx_ref_unique" ON "payments" USING btree ("tx_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "polling_stations_public_id_unique" ON "polling_stations" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registered_voters_station_phone_unique" ON "registered_voters" USING btree ("polling_station_id","phone_number");--> statement-breakpoint
CREATE INDEX "registered_voters_station_token_hash_idx" ON "registered_voters" USING btree ("polling_station_id","token_hash");--> statement-breakpoint
CREATE INDEX "registered_voters_station_approval_status_idx" ON "registered_voters" USING btree ("polling_station_id","approval_status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");