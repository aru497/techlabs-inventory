import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, adminPass, adminUser, sessionToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const user = String(body?.user ?? '').trim();
  const password = String(body?.password ?? '');

  if (user !== adminUser() || password !== adminPass()) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
