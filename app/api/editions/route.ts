import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Edition from '@/models/Edition';
import Media from '@/models/Media';
import { requireAdminAuth } from '@/lib/auth/auth';

// GET /api/editions?eventId=xxx&page=1&limit=15&all=true&search=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const all = searchParams.get('all') === 'true';
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = all ? 500 : Math.min(100, parseInt(searchParams.get('limit') || '15'));

  await connectDB();

  try {
    const query: Record<string, unknown> = {};
    if (eventId) query.eventId = eventId;
    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { slug: { $regex: search.trim().toLowerCase(), $options: 'i' } },
      ];
    }

    const [editions, total] = await Promise.all([
      all
        ? Edition.find(query).sort({ order: 1, createdAt: 1 }).lean()
        : Edition.find(query)
            .sort({ order: 1, createdAt: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
      Edition.countDocuments(query),
    ]);

    // Attach media count to each edition
    const editionsWithStats = await Promise.all(
      editions.map(async (ed) => {
        const mediaCount = await Media.countDocuments({ editionId: ed._id });
        return { ...ed, mediaCount };
      })
    );

    return NextResponse.json({
      editions: editionsWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/editions error:', error);
    return NextResponse.json({ error: 'Failed to fetch editions.' }, { status: 500 });
  }
}

// POST /api/editions - create edition (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  try {
    const body = await request.json();
    const { eventId, name, slug, status, order } = body;

    if (!eventId || !name || !slug) {
      return NextResponse.json(
        { error: 'eventId, name and slug are required.' },
        { status: 400 }
      );
    }

    const existing = await Edition.findOne({
      eventId,
      slug: slug.toLowerCase().trim(),
    });
    if (existing) {
      return NextResponse.json(
        { error: 'An edition with this slug already exists for this event.' },
        { status: 409 }
      );
    }

    const edition = await Edition.create({
      eventId,
      name: name.trim(),
      slug: slug.toLowerCase().trim(),
      status: status || 'active',
      order: order || 0,
    });

    return NextResponse.json({ edition }, { status: 201 });
  } catch (error) {
    console.error('POST /api/editions error:', error);
    return NextResponse.json({ error: 'Failed to create edition.' }, { status: 500 });
  }
}
