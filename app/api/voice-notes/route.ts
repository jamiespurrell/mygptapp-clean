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
  status: 'ACTIVE' | 'CREATED' | 'ARCHIVED' | 'DELETED';
  taskCreatedAt: Date | null;
};

type LegacyVoiceNoteRow = Omit<VoiceNoteRow, 'taskCreatedAt'>;

export const runtime = 'nodejs';

const TAB_QUERY_MAP = {
  active: 'ACTIVE',
  created: 'CREATED',
  archived: 'ARCHIVED',
  deleted: 'DELETED',
} as const;

function parseStatusFromQuery(request: Request) {
  const params = new URL(request.url).searchParams;
  const tab = params.get('tab') ?? params.get('status');
  if (!tab) return { prismaTab: null } as const;
  if (tab in TAB_QUERY_MAP) {
    return { prismaTab: tab as keyof typeof TAB_QUERY_MAP } as const;
  }

  return { error: 'Invalid status query value' } as const;
}

function mapStatus(status: 'ACTIVE' | 'CREATED' | 'ARCHIVED' | 'DELETED') {
  if (status === 'CREATED') return 'created';
  if (status === 'ARCHIVED') return 'archived';
  if (status === 'DELETED') return 'deleted';
  return 'active';
}

function mapType(type: 'TEXT' | 'AUDIO') {
  return type === 'AUDIO' ? 'Voice note' : 'Text note (no recording required)';
}

function mapNoteResponse(note: VoiceNoteRow | LegacyVoiceNoteRow) {
  return {
    ...note,
    taskCreatedAt: 'taskCreatedAt' in note ? note.taskCreatedAt : null,
    noteType: mapType(note.type),
    status: mapStatus(note.status),
  };
}

function isMissingTaskCreatedAtColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message || '') : '';
  return code === 'P2022' || message.includes('task_created_at') || message.includes('taskCreatedAt');
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tabFilter = parseStatusFromQuery(request);
    if ('error' in tabFilter) {
      return NextResponse.json({ error: tabFilter.error }, { status: 400 });
    }

    const whereClause = {
      clerkUserId: userId,
      ...(tabFilter.prismaTab ? { status: TAB_QUERY_MAP[tabFilter.prismaTab] } : {}),
    };

    try {
      const notes = await db.voiceNote.findMany({
        where: whereClause,
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
          taskCreatedAt: true,
        },
      });

      return NextResponse.json({
        notes: notes.map((note: VoiceNoteRow) => mapNoteResponse(note)),
      });
    } catch (error) {
      if (!isMissingTaskCreatedAtColumnError(error)) {
        throw error;
      }

      console.error('GET /api/voice-notes missing task_created_at column; using legacy fallback', error);

      const legacyWhere = {
        clerkUserId: userId,
        ...(tabFilter.prismaTab ? { status: TAB_QUERY_MAP[tabFilter.prismaTab] } : {}),
      };

      const notes = await db.voiceNote.findMany({
        where: legacyWhere,
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
        notes: notes.map((note: LegacyVoiceNoteRow) => mapNoteResponse(note)),
      });
    }
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

    try {
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
          taskCreatedAt: true,
        },
      });

      return NextResponse.json({ note: mapNoteResponse(note) }, { status: 201 });
    } catch (error) {
      if (!isMissingTaskCreatedAtColumnError(error)) {
        throw error;
      }

      console.error('POST /api/voice-notes missing task_created_at column; using legacy fallback', error);

      const legacyNote = await db.voiceNote.create({
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

      return NextResponse.json({ note: mapNoteResponse(legacyNote) }, { status: 201 });
    }
  } catch (error) {
    console.error('POST /api/voice-notes failed', error);
    const message = error instanceof Error ? error.message : 'Failed to save voice note';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
