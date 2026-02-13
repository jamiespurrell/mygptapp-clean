import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth/current-user';
import { db } from '../../../../lib/db';

function mapStatus(status: 'ACTIVE' | 'ARCHIVED' | 'DELETED') {
  if (status === 'ARCHIVED') return 'archived';
  if (status === 'DELETED') return 'deleted';
  return 'active';
}

function mapType(type: 'TEXT' | 'AUDIO') {
  return type === 'AUDIO' ? 'Voice note' : 'Text note (no recording required)';
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      title?: unknown;
      content?: unknown;
    };

    const existingNote = await db.voiceNote.findFirst({
      where: {
        id,
        clerkUserId: user.userId,
      },
      select: { id: true },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Voice note not found' }, { status: 404 });
    }

    const updateData: {
      title?: string | null;
      content?: string | null;
    } = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string') {
        return NextResponse.json({ error: 'title must be a string' }, { status: 400 });
      }

      const trimmed = body.title.trim();
      updateData.title = trimmed || 'Untitled Note';
    }

    if (body.content !== undefined) {
      if (typeof body.content !== 'string') {
        return NextResponse.json({ error: 'content must be a string' }, { status: 400 });
      }

      const trimmed = body.content.trim();
      updateData.content = trimmed || null;
    }

    const note = await db.voiceNote.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        type: true,
        audioUrl: true,
        audioMimeType: true,
        durationMs: true,
        status: true,
      },
    });

    return NextResponse.json({
      note: {
        ...note,
        noteType: mapType(note.type),
        status: mapStatus(note.status),
      },
    });
  } catch (error) {
    console.error('PATCH /api/voice-notes/:id failed', error);
    return NextResponse.json({ error: 'Failed to update voice note' }, { status: 500 });
  }
}
