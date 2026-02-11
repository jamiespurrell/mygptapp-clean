-- AddForeignKey
ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_source_voice_note_id_fkey"
FOREIGN KEY ("source_voice_note_id") REFERENCES "voice_notes"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
