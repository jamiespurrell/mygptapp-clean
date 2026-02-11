import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { getUserWorkspaceContext } from '../_shared';

const VALID_PRIORITIES = new Set([1, 2, 3]);

function parsePriority(value: unknown) {
  const priority = Number(value);
  if (!Number.isInteger(priority) || !VALID_PRIORITIES.has(priority)) {
    return null;
  }

  return priority;
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await getUserWorkspaceContext();
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      title?: unknown;
      notes?: unknown;
      dueDate?: unknown;
      priority?: unknown;
    };

    const existingTask = await db.task.findFirst({
      where: {
        id,
        workspaceId: context.workspace.id,
      },
      select: { id: true },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updateData: {
      title?: string;
      notes?: string | null;
      priority?: number;
      dueDate?: Date | null;
    } = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 });
      }

      updateData.title = body.title.trim();
    }

    if (body.notes !== undefined) {
      if (typeof body.notes !== 'string') {
        return NextResponse.json({ error: 'notes must be a string' }, { status: 400 });
      }

      const trimmed = body.notes.trim();
      updateData.notes = trimmed || null;
    }

    if (body.priority !== undefined) {
      const parsed = parsePriority(body.priority);
      if (parsed === null) {
        return NextResponse.json({ error: 'priority must be one of 1 (Low), 2 (Medium), or 3 (High)' }, { status: 400 });
      }

      updateData.priority = parsed;
    }

    if (body.dueDate !== undefined) {
      if (body.dueDate === null || body.dueDate === '') {
        updateData.dueDate = null;
      } else if (typeof body.dueDate === 'string') {
        const parsedDate = new Date(body.dueDate);
        if (Number.isNaN(parsedDate.getTime())) {
          return NextResponse.json({ error: 'dueDate must be a valid date (yyyy-mm-dd)' }, { status: 400 });
        }

        updateData.dueDate = parsedDate;
      } else {
        return NextResponse.json({ error: 'dueDate must be a string or null' }, { status: 400 });
      }
    }

    const task = await db.task.update({
      where: { id },
      data: updateData,
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
      task: {
        ...task,
        dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : null,
      },
    });
  } catch (error) {
    console.error('PATCH /api/tasks/:id failed', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}
