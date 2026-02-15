ALTER TYPE "VoiceNoteStatus" ADD VALUE IF NOT EXISTS 'CREATED';

UPDATE "voice_notes"
SET "status" = 'CREATED'
WHERE "status" = 'ACTIVE'
  AND "task_created_at" IS NOT NULL;
