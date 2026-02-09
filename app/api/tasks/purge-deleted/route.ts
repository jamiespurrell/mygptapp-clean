import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

function isAuthorized(request: Request, secret: string) {
  const authHeader = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-cron-secret');

  if (headerSecret === secret) return true;
  if (!authHeader?.startsWith('Bearer ')) return false;

  return authHeader.slice('Bearer '.length) === secret;
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('POST /api/tasks/purge-deleted missing CRON_SECRET');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  if (!isAuthorized(request, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await db.task.deleteMany({
      where: {
        status: 'DELETED',
        deletedAt: {
          lte: cutoffDate,
        },
      },
    });

    return NextResponse.json({ deletedCount: result.count });
  } catch (error) {
    console.error('POST /api/tasks/purge-deleted failed', error);
    return NextResponse.json({ error: 'Failed to purge deleted tasks' }, { status: 500 });
  }
}
