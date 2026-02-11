-- Clean up orphaned voice note references before enforcing FK
UPDATE "tasks" t
SET "source_voice_note_id" = NULL
WHERE "source_voice_note_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "voice_notes" v
    WHERE v."id" = t."source_voice_note_id"
  );

-- AddForeignKey
ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_source_voice_note_id_fkey"
FOREIGN KEY ("source_voice_note_id") REFERENCES "voice_notes"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
