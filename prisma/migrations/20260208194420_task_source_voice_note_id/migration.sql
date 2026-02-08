ALTER TABLE "tasks"
ADD COLUMN "source_voice_note_id" TEXT;

CREATE UNIQUE INDEX "tasks_workspace_id_source_voice_note_id_key"
ON "tasks"("workspace_id", "source_voice_note_id");
