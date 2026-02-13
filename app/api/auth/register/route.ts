import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string; name?: string };
    const email = body.email?.toLowerCase().trim() || '';
    const password = body.password || '';
    const name = body.name?.trim() || null;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('POST /api/auth/register failed', error);
    return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
  }
}
