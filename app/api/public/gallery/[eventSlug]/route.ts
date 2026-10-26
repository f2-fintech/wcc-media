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

    // 1. Fetch all active editions for this event
    const rawEditions = await Edition.find({
      eventId: event._id,
      status: 'active',
    })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    // Calculate media counts for each edition
    const editions = await Promise.all(
      rawEditions.map(async (ed) => {
        const count = await Media.countDocuments({ editionId: ed._id });
        return {
          _id: ed._id.toString(),
          name: ed.name,
          slug: ed.slug,
          mediaCount: count,
        };
      })
    );

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

    // 4. Fetch attendees for this edition
    const attendeeQuery: Record<string, unknown> = { eventId: event._id };
    if (currentEdition) {
      attendeeQuery.editionId = currentEdition._id;
    }
    const attendees = await Attendee.find(attendeeQuery)
      .sort({ name: 1 })
      .lean();

    // 5. Query media and counts
    const [mediaItems, totalPhotos, totalVideos, total] = await Promise.all([
      Media.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Media.countDocuments({ ...countQuery, type: 'photo' }),
      Media.countDocuments({ ...countQuery, type: 'video' }),
      Media.countDocuments(query),
    ]);

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

    // Presigned banner URLs
    let desktopBannerUrl = null;
    let mobileBannerUrl = null;
    if (event.desktopBanner?.s3Key) {
      desktopBannerUrl = await getPresignedDownloadUrl(event.desktopBanner.s3Key, 3600);
    }
    if (event.mobileBanner?.s3Key) {
      mobileBannerUrl = await getPresignedDownloadUrl(event.mobileBanner.s3Key, 3600);
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('GET /api/public/gallery/[eventSlug] error:', error);
    return NextResponse.json({ error: 'Failed to load gallery.' }, { status: 500 });
  }
}
