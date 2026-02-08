/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `workspaces` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "workspaces_name_key" ON "workspaces"("name");
