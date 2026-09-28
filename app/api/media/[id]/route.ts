import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Media from '@/models/Media';
import { requireAdminAuth } from '@/lib/auth/auth';
import { deleteS3Object, getPresignedDownloadUrl } from '@/lib/s3/s3.service';

// GET /api/media/[id] - get a single media item with presigned URL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();
  const { id } = await params;

  try {
    const item = await Media.findById(id)
      .populate('attendeeId', 'name email')
      .populate('editionId', 'name')
      .lean();

    if (!item) {
      return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
    }

    const viewUrl = await getPresignedDownloadUrl(item.s3Key, 3600);
    const thumbnailUrl = item.thumbnailKey
      ? await getPresignedDownloadUrl(item.thumbnailKey, 3600)
      : viewUrl;

    return NextResponse.json({ media: { ...item, viewUrl, thumbnailUrl } });
  } catch (error) {
    console.error('GET /api/media/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch media.' }, { status: 500 });
  }
}

// DELETE /api/media/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();
  const { id } = await params;

  try {
    const item = await Media.findById(id);
    if (!item) {
      return NextResponse.json({ error: 'Media not found.' }, { status: 404 });
    }

    // Delete from S3
    await deleteS3Object(item.s3Key);
    if (item.thumbnailKey) {
      await deleteS3Object(item.thumbnailKey).catch(() => {}); // best effort
    }

    await item.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/media/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete media.' }, { status: 500 });
  }
}
