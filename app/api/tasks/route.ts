import { NextResponse } from 'next/server';
import { TaskStatus } from '@prisma/client';
import { db } from '../../../lib/db';
import { getUserWorkspaceContext } from './_shared';

export async function GET() {
  try {
    const context = await getUserWorkspaceContext();
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: 401 });
    }

    const tasks = await db.task.findMany({
      where: {
        workspaceId: context.workspace.id,
        status: { in: [TaskStatus.ACTIVE, TaskStatus.ARCHIVED] },
      },
      orderBy: [{ createdAt: 'desc' }],
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
      tasks: tasks.map((task: any) => ({
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
      return NextResponse.json({ error: context.error }, { status: 401 });
    }

    const body = (await request.json()) as {
      title?: string;
      details?: string;
      dueDate?: string | null;
      urgency?: number | string;
    };

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const dueDate = body.dueDate ? new Date(`${body.dueDate}T00:00:00.000Z`) : null;

    const task = await db.task.create({
      data: {
        workspaceId: context.workspace.id,
        title,
        notes: body.details?.trim() || '',
        priority: Number(body.urgency) || 2,
        dueDate,
        status: TaskStatus.ACTIVE,
      },
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
