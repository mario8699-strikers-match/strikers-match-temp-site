import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This action is not available.' },
    { status: 410 }
  );
}
