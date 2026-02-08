import { db } from "../lib/db";

async function main() {
  // 1) Create (or reuse) a test user
  const user = await db.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: { email: "test@example.com", name: "Test User" },
  });

  // 2) Create a workspace (or reuse if it already exists)
  const workspace = await db.workspace.upsert({
    where: { name: "Test Workspace" },
    update: {},
    create: { name: "Test Workspace" },
  });

  // 3) Ensure the user is a member of the workspace
  await db.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  // 4) Create a few tasks (skip duplicates by title per workspace)
  const existing = await db.task.findMany({
    where: { workspaceId: workspace.id, createdById: user.id },
    select: { title: true },
  });

  const existingTitles = new Set(existing.map((t) => t.title));

  const seedTasks = [
    { title: "Plan today’s top 3 tasks", priority: 1, sortOrder: 1 },
    { title: "Build Today view UI", priority: 2, sortOrder: 2 },
    { title: "Add complete/uncomplete logic", priority: 2, sortOrder: 3 },
  ].filter((t) => !existingTitles.has(t.title));

  for (const t of seedTasks) {
    await db.task.create({
      data: {
        workspaceId: workspace.id,
        createdById: user.id,
        title: t.title,
        priority: t.priority,
        sortOrder: t.sortOrder,
      },
    });
  }

  // 5) Mark the first task completed "today"
  const firstTask = await db.task.findFirst({
    where: { workspaceId: workspace.id, createdById: user.id },
    orderBy: { sortOrder: "asc" },
  });

  if (firstTask) {
    const now = new Date();
    const completedOn = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    await db.taskCompletion.upsert({
      where: {
        taskId_userId_completedOn: {
          taskId: firstTask.id,
          userId: user.id,
          completedOn,
        },
      },
      update: {},
      create: {
        taskId: firstTask.id,
        userId: user.id,
        completedOn,
      },
    });
  }

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
