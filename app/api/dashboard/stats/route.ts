import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Event from '@/models/Event';
import Edition from '@/models/Edition';
import Media from '@/models/Media';
import Attendee from '@/models/Attendee';
import { requireAdminAuth } from '@/lib/auth/auth';

// GET /api/dashboard/stats
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  try {
    const [
      totalEvents,
      totalEditions,
      totalMedia,
      totalPhotos,
      totalVideos,
      totalAttendees,
    ] = await Promise.all([
      Event.countDocuments(),
      Edition.countDocuments(),
      Media.countDocuments(),
      Media.countDocuments({ type: 'photo' }),
      Media.countDocuments({ type: 'video' }),
      Attendee.countDocuments(),
    ]);

    return NextResponse.json({
      totalEvents,
      totalEditions,
      totalMedia,
      totalPhotos,
      totalVideos,
      totalAttendees,
    });
  } catch (error) {
    console.error('GET /api/dashboard/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats.' }, { status: 500 });
  }
}
