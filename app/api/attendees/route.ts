import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Attendee from '@/models/Attendee';
import Media from '@/models/Media';
import { requireAdminAuth } from '@/lib/auth/auth';

// GET /api/attendees?eventId=xxx&page=1&limit=20&search=xxx
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));

  await connectDB();

  try {
    const query: Record<string, unknown> = {};
    if (eventId) query.eventId = eventId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { normalizedEmail: { $regex: search.toLowerCase(), $options: 'i' } },
      ];
    }

    const [attendees, total] = await Promise.all([
      Attendee.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Attendee.countDocuments(query),
    ]);

    // Add media counts
    const attendeesWithCounts = await Promise.all(
      attendees.map(async (attendee) => {
        const mediaCount = await Media.countDocuments({ attendeeId: attendee._id });
        return { ...attendee, mediaCount };
      })
    );

    return NextResponse.json({
      attendees: attendeesWithCounts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('GET /api/attendees error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendees.' }, { status: 500 });
  }
}

// POST /api/attendees - create or find attendee (admin)
export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  try {
    const body = await request.json();
    const { eventId, name, email } = body;

    if (!eventId || !name) {
      return NextResponse.json(
        { error: 'eventId and name are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;

    // Upsert: find or create attendee for this event + email (or name if no email)
    let query: any = { eventId };
    if (normalizedEmail) {
      query.normalizedEmail = normalizedEmail;
    } else {
      query.name = name.trim();
    }

    let attendee = await Attendee.findOne(query);
    if (!attendee) {
      attendee = await Attendee.create({
        eventId,
        name: name.trim(),
        ...(email && { email: email.trim() }),
        ...(normalizedEmail && { normalizedEmail }),
      });
    }

    return NextResponse.json({ attendee }, { status: 201 });
  } catch (error) {
    console.error('POST /api/attendees error:', error);
    return NextResponse.json({ error: 'Failed to create attendee.' }, { status: 500 });
  }
}
