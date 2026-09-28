import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Attendee from '@/models/Attendee';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  await connectDB();
  const { eventSlug } = await params;

  try {
    const body = await request.json();
    const { pin, attendeeId } = body;

    if (!attendeeId) {
      return NextResponse.json({ error: 'Attendee ID is required.' }, { status: 400 });
    }

    const attendee = await Attendee.findById(attendeeId).lean();

    if (!attendee) {
      return NextResponse.json({ error: 'Attendee not found.' }, { status: 404 });
    }

    if (!attendee.downloadPin) {
      return NextResponse.json({ success: true, message: 'No PIN required.' });
    }

    if (attendee.downloadPin !== pin) {
      return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/public/gallery/[eventSlug]/verify-pin error:', error);
    return NextResponse.json({ error: 'Failed to verify PIN.' }, { status: 500 });
  }
}
