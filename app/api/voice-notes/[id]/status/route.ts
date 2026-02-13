import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/auth/current-user';
import { db } from '../../../../../lib/db';

type ItemStatus = 'active' | 'archived' | 'deleted';

function mapUiStatusToPrisma(status: ItemStatus) {
  if (status === 'archived') return 'ARCHIVED';
  if (status === 'deleted') return 'DELETED';
  return 'ACTIVE';
}

function mapPrismaStatusToUi(status: 'ACTIVE' | 'ARCHIVED' | 'DELETED') {
  if (status === 'ARCHIVED') return 'archived';
  if (status === 'DELETED') return 'deleted';
  return 'active';
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as { status?: ItemStatus };

    if (!body.status || !['active', 'archived', 'deleted'].includes(body.status)) {
      return NextResponse.json({ error: 'status must be active, archived, or deleted' }, { status: 400 });
    }

    const existing = await db.voiceNote.findFirst({
      where: { id, clerkUserId: user.userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Voice note not found' }, { status: 404 });
    }

    const updated = await db.voiceNote.update({
      where: { id },
      data: {
        status: mapUiStatusToPrisma(body.status),
        deletedAt: body.status === 'deleted' ? new Date() : null,
      },
      select: {
        id: true,
        status: true,
        deletedAt: true,
      },
    });

    return NextResponse.json({
      note: {
        ...updated,
        status: mapPrismaStatusToUi(updated.status),
      },
    });
  } catch (error) {
    console.error('PATCH /api/voice-notes/:id/status failed', error);
    return NextResponse.json({ error: 'Failed to update voice note status' }, { status: 500 });
  }
}
