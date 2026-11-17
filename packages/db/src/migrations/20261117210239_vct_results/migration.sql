CREATE TABLE "vct_results" (
	"id" text PRIMARY KEY,
	"payload" jsonb NOT NULL,
	"collected_at" timestamp with time zone NOT NULL
);
