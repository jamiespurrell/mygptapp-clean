import { TaskStatus, WorkspaceRole } from '@prisma/client';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '../../../lib/db';

export async function getUserWorkspaceContext() {
  const { userId } = await auth();
  if (!userId) {
    return { error: 'Unauthorized' } as const;
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) {
    return { error: 'No primary email available' } as const;
  }

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  const workspaceName = `${email} Personal Workspace`;
  const workspace = await db.workspace.upsert({
    where: { name: workspaceName },
    update: {},
    create: { name: workspaceName },
  });

  await db.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: { role: WorkspaceRole.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
    },
  });

  return { user, workspace } as const;
}

export function mapUiStatusToPrisma(status: 'active' | 'archived' | 'deleted') {
  if (status === 'active') return TaskStatus.ACTIVE;
  return TaskStatus.ARCHIVED;
}
