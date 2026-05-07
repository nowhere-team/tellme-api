DROP INDEX "stories_feed_idx";--> statement-breakpoint
ALTER TABLE "stories" ALTER COLUMN "raw" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "status" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "preview" text;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "total_vote_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "stories_feed_hot_idx" ON "stories" USING btree ("status","published_at","total_vote_count");--> statement-breakpoint
CREATE INDEX "stories_feed_new_idx" ON "stories" USING btree ("status","published_at");