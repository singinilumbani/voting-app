ALTER TABLE "device_records" ALTER COLUMN "device_fingerprint_hash" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ALTER COLUMN "token_hash" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "registered_voters" ALTER COLUMN "token_hash" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "registered_voters" ALTER COLUMN "device_fingerprint_hash" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "registered_voters" ALTER COLUMN "ip_hash" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "token_hash" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "device_records" ADD CONSTRAINT "device_records_device_fingerprint_hash_format_check" CHECK ("device_records"."device_fingerprint_hash" IS NULL OR "device_records"."device_fingerprint_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_token_hash_format_check" CHECK ("password_reset_tokens"."token_hash" IS NULL OR "password_reset_tokens"."token_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "registered_voters" ADD CONSTRAINT "registered_voters_token_hash_format_check" CHECK ("registered_voters"."token_hash" IS NULL OR "registered_voters"."token_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "registered_voters" ADD CONSTRAINT "registered_voters_ip_hash_format_check" CHECK ("registered_voters"."ip_hash" IS NULL OR "registered_voters"."ip_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "registered_voters" ADD CONSTRAINT "registered_voters_device_fingerprint_hash_format_check" CHECK ("registered_voters"."device_fingerprint_hash" IS NULL OR "registered_voters"."device_fingerprint_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_hash_format_check" CHECK ("sessions"."token_hash" IS NULL OR "sessions"."token_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_password_hash_format_check" CHECK ("users"."password_hash" ~ '^[a-z0-9-]+\$[0-9]+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$');