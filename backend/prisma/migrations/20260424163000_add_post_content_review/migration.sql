ALTER TABLE "posts"
ADD COLUMN "contentReview" JSONB,
ADD COLUMN "reviewCheckedAt" TIMESTAMP(3);
