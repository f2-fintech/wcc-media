import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Event from '@/models/Event';
import Edition from '@/models/Edition';
import Media from '@/models/Media';
import { requireAdminAuth } from '@/lib/auth/auth';

// GET /api/events?page=1&limit=10&search=xxx&all=true
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const all = searchParams.get('all') === 'true';
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = all ? 500 : Math.min(100, parseInt(searchParams.get('limit') || '10'));

  await connectDB();

  try {
    const query: Record<string, unknown> = {};
    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { slug: { $regex: search.trim().toLowerCase(), $options: 'i' } },
      ];
    }

    const [events, total] = await Promise.all([
      all
        ? Event.find(query).sort({ name: 1 }).lean()
        : Event.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
      Event.countDocuments(query),
    ]);

    // Add counts
    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const editionCount = await Edition.countDocuments({ eventId: event._id });
        const mediaCount = await Media.countDocuments({ eventId: event._id });
        return { ...event, editionCount, mediaCount };
      })
    );

    return NextResponse.json({
      events: eventsWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/events error:', error);
    return NextResponse.json({ error: 'Failed to fetch events.' }, { status: 500 });
  }
}

// POST /api/events - create a new event (admin)
export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  try {
    const body = await request.json();
    const { name, slug, description, active } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required.' }, { status: 400 });
    }

    const existing = await Event.findOne({ slug: slug.toLowerCase().trim() });
    if (existing) {
      return NextResponse.json({ error: 'An event with this slug already exists.' }, { status: 409 });
    }

    const event = await Event.create({
      name: name.trim(),
      slug: slug.toLowerCase().trim(),
      description: description?.trim(),
      active: active !== undefined ? active : true,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error('POST /api/events error:', error);
    return NextResponse.json({ error: 'Failed to create event.' }, { status: 500 });
  }
}
