import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '../../../lib/db';

async function getOrCreateUserWorkspace() {
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
    update: { role: 'OWNER' },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  return { user, workspace } as const;
}

export async function GET() {
  try {
    const context = await getOrCreateUserWorkspace();
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: 401 });
    }

    const tasks = await db.task.findMany({
      where: {
        workspaceId: context.workspace.id,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('GET /api/tasks failed', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getOrCreateUserWorkspace();
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: 401 });
    }

    const body = (await request.json()) as { title?: string };
    const title = body.title?.trim();

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const task = await db.task.create({
      data: {
        workspaceId: context.workspace.id,
        createdById: context.user.id,
        title,
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks failed', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
