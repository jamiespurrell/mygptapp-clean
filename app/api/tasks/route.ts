import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '../../../lib/db';

const VALID_PRIORITIES = new Set([1, 2, 3]);

function parsePriority(value: unknown) {
  const priority = Number(value);
  if (!Number.isInteger(priority) || !VALID_PRIORITIES.has(priority)) {
    return null;
  }

  return priority;
}

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
        notes: true,
        dueDate: true,
        priority: true,
        status: true,
        sourceVoiceNoteId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      tasks: tasks.map((task: { dueDate: Date | null }) => ({
        ...task,
        dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : null,
      })),
    });
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

    const body = (await request.json()) as {
      title?: string;
      notes?: string;
      details?: string;
      dueDate?: string | null;
      priority?: unknown;
      urgency?: unknown;
      sourceVoiceNoteId?: unknown;
    };

    const title = body.title?.trim();
    const notes = (body.notes ?? body.details)?.trim();

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const priority = parsePriority(body.priority ?? body.urgency);
    if (priority === null) {
      return NextResponse.json({ error: 'priority must be one of 1 (Low), 2 (Medium), or 3 (High)' }, { status: 400 });
    }

    const sourceVoiceNoteId = typeof body.sourceVoiceNoteId === 'string' && body.sourceVoiceNoteId.trim()
      ? body.sourceVoiceNoteId.trim()
      : null;

    if (body.sourceVoiceNoteId !== undefined && sourceVoiceNoteId === null) {
      return NextResponse.json({ error: 'sourceVoiceNoteId must be a non-empty string when provided' }, { status: 400 });
    }

    if (sourceVoiceNoteId) {
      const existingTask = await db.task.findFirst({
        where: {
          workspaceId: context.workspace.id,
          sourceVoiceNoteId,
        },
        select: { id: true },
      });

      if (existingTask) {
        return NextResponse.json(
          { error: 'A task has already been created from this voice note', existingTaskId: existingTask.id },
          { status: 409 },
        );
      }
    }

    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.dueDate && Number.isNaN(dueDate?.getTime())) {
      return NextResponse.json({ error: 'dueDate must be a valid date (yyyy-mm-dd)' }, { status: 400 });
    }

    const task = await db.task.create({
      data: {
        workspaceId: context.workspace.id,
        createdById: context.user.id,
        title,
        notes: notes || null,
        priority,
        dueDate,
        sourceVoiceNoteId,
      },
      select: {
        id: true,
        title: true,
        notes: true,
        dueDate: true,
        priority: true,
        status: true,
        sourceVoiceNoteId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        task: {
          ...task,
          dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/tasks failed', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
