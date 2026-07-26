import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Diagnostic only: reports WHICH env vars are visible to the running app.
// Never returns the values themselves — just booleans + lengths.
export async function GET() {
  const check = (v?: string) => ({ set: Boolean(v), length: v ? v.length : 0 });
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: check(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: check(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: check(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ANTHROPIC_API_KEY: check(process.env.ANTHROPIC_API_KEY),
    ANTHROPIC_MODEL: check(process.env.ANTHROPIC_MODEL),
  });
}
