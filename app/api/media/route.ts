import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Media from '@/models/Media';
import { requireAdminAuth } from '@/lib/auth/auth';
import { getPresignedDownloadUrl } from '@/lib/s3/s3.service';

// GET /api/media?eventId=xxx&editionId=xxx&attendeeId=xxx&type=photo&page=1&limit=24&search=xxx
export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const editionId = searchParams.get('editionId');
  const attendeeId = searchParams.get('attendeeId');
  const type = searchParams.get('type');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '24'));

  await connectDB();

  try {
    const query: Record<string, unknown> = {};
    if (eventId) query.eventId = eventId;
    if (editionId) query.editionId = editionId;
    if (attendeeId) query.attendeeId = attendeeId;
    if (type && (type === 'photo' || type === 'video')) query.type = type;

    const [mediaItems, total] = await Promise.all([
      Media.find(query)
        .populate('attendeeId', 'name email')
        .populate('editionId', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Media.countDocuments(query),
    ]);

    // Generate presigned thumbnail URLs
    const mediaWithUrls = await Promise.all(
      mediaItems.map(async (item) => {
        const thumbnailUrl = item.thumbnailKey
          ? await getPresignedDownloadUrl(item.thumbnailKey, 3600)
          : await getPresignedDownloadUrl(item.s3Key, 3600);
        return { ...item, thumbnailUrl };
      })
    );

    return NextResponse.json({
      media: mediaWithUrls,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('GET /api/media error:', error);
    return NextResponse.json({ error: 'Failed to fetch media.' }, { status: 500 });
  }
}
