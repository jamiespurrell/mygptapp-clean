-- CreateEnum
CREATE TYPE "VoiceNoteType" AS ENUM ('TEXT', 'AUDIO');

-- CreateEnum
CREATE TYPE "VoiceNoteStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateTable
CREATE TABLE "voice_notes" (
    "id" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "type" "VoiceNoteType" NOT NULL DEFAULT 'TEXT',
    "title" TEXT,
    "content" TEXT,
    "audio_url" TEXT,
    "audio_mime_type" TEXT,
    "duration_ms" INTEGER,
    "status" "VoiceNoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_notes_clerk_user_id_status_idx" ON "voice_notes"("clerk_user_id", "status");
