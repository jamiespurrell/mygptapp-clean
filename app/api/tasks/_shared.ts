import { db } from '../../../lib/db';
import { getCurrentUserEmail } from '../../../lib/auth/current-user';

export async function getUserWorkspaceContext() {
  const email = await getCurrentUserEmail();
  if (!email) {
    return { error: 'Unauthorized' } as const;
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
    update: { role: 'OWNER' },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  return { user, workspace } as const;
}

export function mapUiStatusToPrisma(status: 'active' | 'archived' | 'deleted') {
  if (status === 'active') return 'ACTIVE';
  if (status === 'deleted') return 'DELETED';
  return 'ARCHIVED';
}
