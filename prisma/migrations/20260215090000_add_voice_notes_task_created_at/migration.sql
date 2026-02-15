ALTER TABLE "voice_notes"
ADD COLUMN "task_created_at" TIMESTAMP(3);

CREATE INDEX "voice_notes_clerk_user_id_status_task_created_at_idx"
ON "voice_notes"("clerk_user_id", "status", "task_created_at");
