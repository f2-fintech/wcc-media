import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Attendee from '@/models/Attendee';
import Edition from '@/models/Edition';
import Media from '@/models/Media';
import { requireAdminAuth } from '@/lib/auth/auth';

// GET /api/attendees?eventId=xxx&editionId=xxx&page=1&limit=20&search=xxx&all=true
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const editionId = searchParams.get('editionId');
  const search = searchParams.get('search') || '';
  const all = searchParams.get('all') === 'true';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = all ? 1000 : Math.min(100, parseInt(searchParams.get('limit') || '10'));

  await connectDB();

  try {
    const query: Record<string, unknown> = {};
    if (eventId) query.eventId = eventId;
    if (editionId) query.editionId = editionId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { normalizedEmail: { $regex: search.toLowerCase(), $options: 'i' } },
      ];
    }

    const [attendees, total] = await Promise.all([
      Attendee.find(query)
        .populate('editionId', 'name slug')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Attendee.countDocuments(query),
    ]);

    // Add media counts
    const attendeesWithCounts = await Promise.all(
      attendees.map(async (attendee) => {
        const countQuery: Record<string, unknown> = { attendeeId: attendee._id };
        if (editionId) {
          countQuery.editionId = editionId;
        } else if (attendee.editionId) {
          countQuery.editionId = (attendee.editionId as any)._id || attendee.editionId;
        }
        const mediaCount = await Media.countDocuments(countQuery);
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

// POST /api/attendees - create or find attendee/folder (admin)
export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  try {
    const body = await request.json();
    const { eventId, editionId, name, email, downloadPin, attendeeId } = body;

    if (attendeeId) {
      const existing = await Attendee.findById(attendeeId);
      if (existing) {
        return NextResponse.json({ attendee: existing }, { status: 200 });
      }
    }

    if (!eventId || !name || !name.trim()) {
      return NextResponse.json(
        { error: 'eventId and folder name are required.' },
        { status: 400 }
      );
    }

    // Resolve editionId if not explicitly provided
    let targetEditionId = editionId;
    if (!targetEditionId) {
      const firstEdition = await Edition.findOne({ eventId, status: 'active' }).sort({ order: 1, createdAt: 1 });
      if (firstEdition) {
        targetEditionId = firstEdition._id;
      }
    }

    const trimmedName = name.trim();
    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Case-insensitive lookup under the same event and edition
    const lookupQuery: Record<string, unknown> = {
      eventId,
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    };
    if (targetEditionId) {
      lookupQuery.editionId = targetEditionId;
    }

    let attendee = await Attendee.findOne(lookupQuery);

    if (!attendee && normalizedEmail) {
      const emailLookup: Record<string, unknown> = {
        eventId,
        normalizedEmail,
      };
      if (targetEditionId) {
        emailLookup.editionId = targetEditionId;
      }
      attendee = await Attendee.findOne(emailLookup);
    }

    if (!attendee) {
      attendee = await Attendee.create({
        eventId,
        ...(targetEditionId && { editionId: targetEditionId }),
        name: trimmedName,
        ...(email && { email: email.trim() }),
        ...(normalizedEmail && { normalizedEmail }),
        ...(downloadPin && { downloadPin: downloadPin.trim() }),
      });
      return NextResponse.json({ attendee }, { status: 201 });
    } else {
      // If found existing folder, update email / downloadPin / editionId if provided
      let modified = false;
      if (targetEditionId && (!attendee.editionId || attendee.editionId.toString() !== targetEditionId.toString())) {
        attendee.editionId = targetEditionId;
        modified = true;
      }
      if (email && (!attendee.email || attendee.email !== email.trim())) {
        attendee.email = email.trim();
        attendee.normalizedEmail = email.toLowerCase().trim();
        modified = true;
      }
      if (downloadPin !== undefined && attendee.downloadPin !== downloadPin.trim()) {
        attendee.downloadPin = downloadPin.trim();
        modified = true;
      }
      if (modified) {
        await attendee.save();
      }
      return NextResponse.json({ attendee }, { status: 200 });
    }
  } catch (error) {
    console.error('POST /api/attendees error:', error);
    return NextResponse.json({ error: 'Failed to create or find folder.' }, { status: 500 });
  }
}
