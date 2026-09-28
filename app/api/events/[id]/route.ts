import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Event from '@/models/Event';
import { requireAdminAuth } from '@/lib/auth/auth';

// GET /api/events/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();
  const { id } = await params;

  try {
    const event = await Event.findById(id).lean();
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }
    return NextResponse.json({ event });
  } catch (error) {
    console.error('GET /api/events/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch event.' }, { status: 500 });
  }
}

// PATCH /api/events/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();
  const { id } = await params;

  try {
    const body = await request.json();
    const { name, slug, description, active } = body;

    if (slug) {
      const existing = await Event.findOne({
        slug: slug.toLowerCase().trim(),
        _id: { $ne: id },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'An event with this slug already exists.' },
          { status: 409 }
        );
      }
    }

    const updated = await Event.findByIdAndUpdate(
      id,
      {
        ...(name && { name: name.trim() }),
        ...(slug && { slug: slug.toLowerCase().trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(active !== undefined && { active }),
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    return NextResponse.json({ event: updated });
  } catch (error) {
    console.error('PATCH /api/events/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update event.' }, { status: 500 });
  }
}

// DELETE /api/events/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();
  const { id } = await params;

  try {
    const event = await Event.findByIdAndDelete(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/events/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete event.' }, { status: 500 });
  }
}
