import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Edition from '@/models/Edition';
import { requireAdminAuth } from '@/lib/auth/auth';

// PATCH /api/editions/[id]
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
    const { name, slug, status, order } = body;

    const updated = await Edition.findByIdAndUpdate(
      id,
      {
        ...(name && { name: name.trim() }),
        ...(slug && { slug: slug.toLowerCase().trim() }),
        ...(status && { status }),
        ...(order !== undefined && { order }),
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Edition not found.' }, { status: 404 });
    }

    return NextResponse.json({ edition: updated });
  } catch (error) {
    console.error('PATCH /api/editions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update edition.' }, { status: 500 });
  }
}

// DELETE /api/editions/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();
  const { id } = await params;

  try {
    const edition = await Edition.findByIdAndDelete(id);
    if (!edition) {
      return NextResponse.json({ error: 'Edition not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/editions/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete edition.' }, { status: 500 });
  }
}
