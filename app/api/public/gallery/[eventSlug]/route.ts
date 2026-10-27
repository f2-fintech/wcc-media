import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Event from '@/models/Event';
import Edition from '@/models/Edition';
import Attendee from '@/models/Attendee';
import Media from '@/models/Media';
import { getPresignedDownloadUrl } from '@/lib/s3/s3.service';

// GET /api/public/gallery/[eventSlug]?editionId=xxx&attendeeId=xxx&type=photo|video&page=1&limit=24
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  await connectDB();
  const { eventSlug } = await params;

  const { searchParams } = new URL(request.url);
  const requestedEdition = searchParams.get('editionId') || searchParams.get('edition');
  const attendeeId = searchParams.get('attendeeId');
  const type = searchParams.get('type');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(1000, parseInt(searchParams.get('limit') || '24'));

  try {
    const event = await Event.findOne({
      slug: eventSlug.toLowerCase(),
      active: true,
    }).lean();

    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    // 1. Fetch active editions and edition media counts in a single parallel step
    const [rawEditions, editionCounts] = await Promise.all([
      Edition.find({
        eventId: event._id,
        status: 'active',
      })
        .sort({ order: 1, createdAt: -1 })
        .lean(),
      Media.aggregate([
        { $match: { eventId: event._id } },
        { $group: { _id: '$editionId', count: { $sum: 1 } } },
      ]),
    ]);

    const editionCountMap = new Map<string, number>();
    for (const ec of editionCounts) {
      if (ec._id) editionCountMap.set(ec._id.toString(), ec.count);
    }

    const editions = rawEditions.map((ed) => ({
      _id: ed._id.toString(),
      name: ed.name,
      slug: ed.slug,
      mediaCount: editionCountMap.get(ed._id.toString()) || 0,
    }));

    // 2. Resolve current active edition
    let currentEdition = null;
    if (requestedEdition) {
      currentEdition =
        rawEditions.find(
          (e) =>
            e._id.toString() === requestedEdition ||
            e.slug.toLowerCase() === requestedEdition.toLowerCase()
        ) || null;
    }
    if (!currentEdition && rawEditions.length > 0) {
      currentEdition = rawEditions[0];
    }

    // 3. Build media query
    const query: Record<string, unknown> = { eventId: event._id };
    if (currentEdition) {
      query.editionId = currentEdition._id;
    }
    if (attendeeId) query.attendeeId = attendeeId;
    if (type && (type === 'photo' || type === 'video')) query.type = type;

    // Build count query
    const countQuery: Record<string, unknown> = { eventId: event._id };
    if (currentEdition) {
      countQuery.editionId = currentEdition._id;
    }

    // 4. Fetch attendees for this edition (only id, name, slug)
    const attendeeQuery: Record<string, unknown> = { eventId: event._id };
    if (currentEdition) {
      attendeeQuery.editionId = currentEdition._id;
    }

    // 5. Query media, attendees, and counts in parallel
    const [attendees, mediaItems, counts] = await Promise.all([
      Attendee.find(attendeeQuery)
        .select('_id name')
        .sort({ name: 1 })
        .lean(),
      Media.find(query)
        .select('_id type originalFileName mimeType thumbnailKey s3Key createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Media.aggregate([
        { $match: countQuery },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    let totalPhotos = 0;
    let totalVideos = 0;
    for (const c of counts) {
      if (c._id === 'photo') totalPhotos = c.count;
      if (c._id === 'video') totalVideos = c.count;
    }
    const total = totalPhotos + totalVideos;

    // Generate presigned thumbnail URLs
    const mediaWithUrls = await Promise.all(
      mediaItems.map(async (item) => {
        const thumbnailUrl = item.thumbnailKey
          ? await getPresignedDownloadUrl(item.thumbnailKey, 3600)
          : await getPresignedDownloadUrl(item.s3Key, 3600);
        return {
          _id: item._id,
          type: item.type,
          originalFileName: item.originalFileName,
          mimeType: item.mimeType,
          thumbnailUrl,
          createdAt: item.createdAt,
        };
      })
    );

    // Presigned banner URLs: prioritize current edition banner, fallback to event banner
    let desktopBannerUrl = null;
    let mobileBannerUrl = null;
    const desktopS3Key =
      (currentEdition as any)?.desktopBanner?.s3Key || event.desktopBanner?.s3Key;
    const mobileS3Key =
      (currentEdition as any)?.mobileBanner?.s3Key || event.mobileBanner?.s3Key;

    if (desktopS3Key) {
      desktopBannerUrl = await getPresignedDownloadUrl(desktopS3Key, 3600);
    }
    if (mobileS3Key) {
      mobileBannerUrl = await getPresignedDownloadUrl(mobileS3Key, 3600);
    }

    return NextResponse.json(
      {
        event: {
          _id: event._id,
          name: event.name,
          slug: event.slug,
          description: event.description,
          editionName: currentEdition?.name || null,
          desktopBannerUrl,
          mobileBannerUrl,
        },
        editions,
        currentEdition: currentEdition
          ? {
              _id: currentEdition._id.toString(),
              name: currentEdition.name,
              slug: currentEdition.slug,
            }
          : null,
        attendees,
        totalPhotos,
        totalVideos,
        media: mediaWithUrls,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('GET /api/public/gallery/[eventSlug] error:', error);
    return NextResponse.json({ error: 'Failed to load gallery.' }, { status: 500 });
  }
}
