import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Attendee from '@/models/Attendee';
import { requireAdminAuth } from '@/lib/auth/auth';

// PATCH /api/attendees/[id]
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
    const { name, email, downloadPin } = body;

    const updateData: Record<string, string> = {};
    if (name) updateData.name = name.trim();
    if (email) {
      updateData.email = email.trim();
      updateData.normalizedEmail = email.toLowerCase().trim();
    }
    if (downloadPin !== undefined) updateData.downloadPin = downloadPin.trim();

    const updated = await Attendee.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return NextResponse.json({ error: 'Attendee not found.' }, { status: 404 });
    }

    return NextResponse.json({ attendee: updated });
  } catch (error) {
    console.error('PATCH /api/attendees/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update attendee.' }, { status: 500 });
  }
}

// DELETE /api/attendees/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();
  const { id } = await params;

  try {
    const attendee = await Attendee.findByIdAndDelete(id);
    if (!attendee) {
      return NextResponse.json({ error: 'Attendee not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/attendees/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete attendee.' }, { status: 500 });
  }
}
