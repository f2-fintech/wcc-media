import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Media from '@/models/Media';
import Attendee from '@/models/Attendee';
import { requireAdminAuth } from '@/lib/auth/auth';
import { deleteS3Object } from '@/lib/s3/s3.service';

// POST /api/media/bulk-delete
export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required.' }, { status: 400 });
    }

    const items = await Media.find({ _id: { $in: ids } });

    // Delete from S3 (best effort)
    await Promise.allSettled(
      items.flatMap((item) => [
        deleteS3Object(item.s3Key),
        ...(item.thumbnailKey ? [deleteS3Object(item.thumbnailKey)] : []),
      ])
    );

    await Media.deleteMany({ _id: { $in: ids } });

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('POST /api/media/bulk-delete error:', error);
    return NextResponse.json({ error: 'Failed to delete media.' }, { status: 500 });
  }
}
