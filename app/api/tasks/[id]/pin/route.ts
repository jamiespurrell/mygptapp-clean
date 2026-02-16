import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { getUserWorkspaceContext } from '../../_shared';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await getUserWorkspaceContext();
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as { isPinned?: unknown };

    if (typeof body.isPinned !== 'boolean') {
      return NextResponse.json({ error: 'isPinned must be a boolean' }, { status: 400 });
    }

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

    const task = await db.task.update({
      where: { id },
      data: {
        isPinned: body.isPinned,
        pinnedAt: body.isPinned ? new Date() : null,
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
        isPinned: true,
        pinnedAt: true,
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
    console.error('PATCH /api/tasks/:id/pin failed', error);
    return NextResponse.json({ error: 'Failed to update task pin status' }, { status: 500 });
  }
}
