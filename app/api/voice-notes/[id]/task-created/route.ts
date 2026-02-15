import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';

function isMissingTaskCreatedAtColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message || '') : '';
  return code === 'P2022' || message.includes('task_created_at') || message.includes('taskCreatedAt');
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
      const existing = await db.voiceNote.findFirst({
        where: { id, clerkUserId: userId },
        select: { taskCreatedAt: true },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Voice note not found' }, { status: 404 });
      }

      if (existing.taskCreatedAt) {
        return NextResponse.json({
          note: { taskCreatedAt: toIsoString(existing.taskCreatedAt) },
        });
      }

      const updated = await db.voiceNote.update({
        where: { id },
        data: { taskCreatedAt: new Date() },
        select: { taskCreatedAt: true },
      });

      if (!updated.taskCreatedAt) {
        return NextResponse.json({ error: 'Failed to mark voice note as created' }, { status: 500 });
      }

      return NextResponse.json({
        note: { taskCreatedAt: toIsoString(updated.taskCreatedAt) },
      });
    } catch (error) {
      if (isMissingTaskCreatedAtColumnError(error)) {
        console.error('PATCH /api/voice-notes/:id/task-created missing task_created_at column', error);
        return NextResponse.json(
          { error: 'Database migration required: task_created_at column is missing' },
          { status: 500 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('PATCH /api/voice-notes/:id/task-created failed', error);
    const message = error instanceof Error ? error.message : 'Failed to mark voice note as created';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
