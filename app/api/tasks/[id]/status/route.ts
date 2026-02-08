import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { getUserWorkspaceContext, mapUiStatusToPrisma } from '../../_shared';

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const context = await getUserWorkspaceContext();
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: 401 });
    }

    const { id } = params;
    const body = (await request.json()) as { status?: 'active' | 'archived' | 'deleted' };

    if (!body.status || !['active', 'archived', 'deleted'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
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
      data: { status: mapUiStatusToPrisma(body.status) },
      select: {
        id: true,
        title: true,
        notes: true,
        dueDate: true,
        priority: true,
        status: true,
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
    console.error('PATCH /api/tasks/:id/status failed', error);
    return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 });
  }
}
