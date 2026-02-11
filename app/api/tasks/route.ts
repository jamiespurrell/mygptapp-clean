import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { getUserWorkspaceContext } from './_shared';

const VALID_PRIORITIES = new Set([1, 2, 3]);

function parsePriority(value: unknown) {
  const priority = Number(value);
  if (!Number.isInteger(priority) || !VALID_PRIORITIES.has(priority)) {
    return null;
  }

  return priority;
}

function authErrorStatus(error: unknown) {
  return error === 'Unauthorized' ? 401 : 500;
}


const STATUS_QUERY_MAP = {
  active: 'ACTIVE',
  archived: 'ARCHIVED',
  deleted: 'DELETED',
} as const;

function parseStatusFromQuery(request: Request) {
  const status = new URL(request.url).searchParams.get('status');
  if (!status) {
    return { prismaStatus: null } as const;
  }

  if (status in STATUS_QUERY_MAP) {
    return { prismaStatus: STATUS_QUERY_MAP[status as keyof typeof STATUS_QUERY_MAP] } as const;
  }

  return { error: 'Invalid status query value' } as const;
}

export async function GET(request: Request) {
  try {
    const context = await getUserWorkspaceContext();
    if ('error' in context) {
      const status = authErrorStatus(context.error);
      if (status === 500) {
        console.error('GET /api/tasks failed to resolve user workspace context', {
          reason: context.error,
        });
      }

      return NextResponse.json({ error: context.error }, { status });
    }

    const statusFilter = parseStatusFromQuery(request);
    if ('error' in statusFilter) {
      return NextResponse.json({ error: statusFilter.error }, { status: 400 });
    }

    const tasks = await db.task.findMany({
      where: {
        workspaceId: context.workspace.id,
        ...(statusFilter.prismaStatus ? { status: statusFilter.prismaStatus } : {}),
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
        sourceVoiceNote: {
          select: {
            id: true,
            type: true,
            audioUrl: true,
          },
        },
        deletedAt: true,
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
    const context = await getUserWorkspaceContext();
    if ('error' in context) {
      const status = authErrorStatus(context.error);
      if (status === 500) {
        console.error('POST /api/tasks failed to resolve user workspace context', {
          reason: context.error,
        });
      }

      return NextResponse.json({ error: context.error }, { status });
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
        sourceVoiceNote: {
          select: {
            id: true,
            type: true,
            audioUrl: true,
          },
        },
        deletedAt: true,
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
