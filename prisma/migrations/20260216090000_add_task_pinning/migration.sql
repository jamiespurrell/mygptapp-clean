-- AlterTable
ALTER TABLE "tasks"
ADD COLUMN "is_pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pinned_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tasks_workspace_id_status_is_pinned_pinned_at_idx"
ON "tasks"("workspace_id", "status", "is_pinned", "pinned_at");
