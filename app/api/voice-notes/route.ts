import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/db';

type VoiceNoteRow = {
  id: string;
  title: string | null;
  content: string | null;
  createdAt: Date;
  type: 'TEXT' | 'AUDIO';
  audioUrl: string | null;
  audioMimeType: string | null;
  durationMs: number | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
};

export const runtime = 'nodejs';

const STATUS_QUERY_MAP = {
  active: 'ACTIVE',
  archived: 'ARCHIVED',
  deleted: 'DELETED',
} as const;

function parseStatusFromQuery(request: Request) {
  const status = new URL(request.url).searchParams.get('status');
  if (!status) return { prismaStatus: null } as const;
  if (status in STATUS_QUERY_MAP) {
    return { prismaStatus: STATUS_QUERY_MAP[status as keyof typeof STATUS_QUERY_MAP] } as const;
  }

  return { error: 'Invalid status query value' } as const;
}

function mapStatus(status: 'ACTIVE' | 'ARCHIVED' | 'DELETED') {
  if (status === 'ARCHIVED') return 'archived';
  if (status === 'DELETED') return 'deleted';
  return 'active';
}

function mapType(type: 'TEXT' | 'AUDIO') {
  return type === 'AUDIO' ? 'Voice note' : 'Text note (no recording required)';
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const statusFilter = parseStatusFromQuery(request);
    if ('error' in statusFilter) {
      return NextResponse.json({ error: statusFilter.error }, { status: 400 });
    }

    const notes = await db.voiceNote.findMany({
      where: {
        clerkUserId: userId,
        ...(statusFilter.prismaStatus ? { status: statusFilter.prismaStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
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
      notes: notes.map((note: VoiceNoteRow) => ({
        ...note,
        noteType: mapType(note.type),
        status: mapStatus(note.status),
      })),
    });
  } catch (error) {
    console.error('GET /api/voice-notes failed', error);
    return NextResponse.json({ error: 'Failed to fetch voice notes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const titleInput = formData.get('title');
    const contentInput = formData.get('content');
    const typeInput = formData.get('type');
    const durationInput = formData.get('durationMs');
    const audioFile = formData.get('audio');

    const title = typeof titleInput === 'string' ? titleInput.trim() : '';
    const content = typeof contentInput === 'string' ? contentInput.trim() : '';
    const requestedType = typeInput === 'AUDIO' ? 'AUDIO' : 'TEXT';
    const hasAudio = audioFile instanceof File && audioFile.size > 0;

    const type = hasAudio ? 'AUDIO' : requestedType;
    if (!title && !content && !hasAudio) {
      return NextResponse.json({ error: 'title, content, or audio is required' }, { status: 400 });
    }

    let audioUrl: string | null = null;
    let audioMimeType: string | null = null;
    if (hasAudio) {
      const buffer = Buffer.from(await audioFile.arrayBuffer());
      const ext = audioFile.name.includes('.')
        ? audioFile.name.split('.').pop() || 'webm'
        : audioFile.type.split('/')[1] || 'webm';
      const fileName = `${Date.now()}-${randomUUID()}.${ext}`;
      const relativePath = path.join('uploads', 'voice-notes', fileName);
      const absoluteDir = path.join(process.cwd(), 'public', 'uploads', 'voice-notes');
      await mkdir(absoluteDir, { recursive: true });
      await writeFile(path.join(process.cwd(), 'public', relativePath), buffer);
      audioUrl = `/${relativePath.replaceAll(path.sep, '/')}`;
      audioMimeType = audioFile.type || null;
    }

    const durationMs = typeof durationInput === 'string' && durationInput.trim()
      ? Number.parseInt(durationInput, 10)
      : null;

    const note = await db.voiceNote.create({
      data: {
        clerkUserId: userId,
        type,
        title: title || 'Untitled Note',
        content: content || null,
        audioUrl,
        audioMimeType,
        durationMs: Number.isFinite(durationMs) ? durationMs : null,
      },
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

    return NextResponse.json(
      {
        note: {
          ...note,
          noteType: mapType(note.type),
          status: mapStatus(note.status),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/voice-notes failed', error);
    return NextResponse.json({ error: 'Failed to save voice note' }, { status: 500 });
  }
}
