import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.voiceNote.findFirst({
      where: { id, clerkUserId: userId },
      select: { id: true, taskCreatedAt: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Voice note not found' }, { status: 404 });
    }

    if (existing.taskCreatedAt) {
      return NextResponse.json({ note: { id: existing.id, taskCreatedAt: existing.taskCreatedAt } });
    }

    const updated = await db.voiceNote.update({
      where: { id },
      data: { taskCreatedAt: new Date() },
      select: { id: true, taskCreatedAt: true },
    });

    return NextResponse.json({ note: updated });
  } catch (error) {
    console.error('PATCH /api/voice-notes/:id/task-created failed', error);
    return NextResponse.json({ error: 'Failed to mark voice note as created' }, { status: 500 });
  }
}
