import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Edition from '@/models/Edition';
import Media from '@/models/Media';
import { requireAdminAuth } from '@/lib/auth/auth';

// GET /api/editions?eventId=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');

  // Public endpoint for gallery (no auth required for active editions)
  await connectDB();

  try {
    const query: Record<string, unknown> = {};
    if (eventId) query.eventId = eventId;

    const editions = await Edition.find(query).sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ editions });
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
