import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Event from '@/models/Event';
import Attendee from '@/models/Attendee';
import Media from '@/models/Media';
import { getPresignedDownloadUrl } from '@/lib/s3/s3.service';

// GET /api/public/gallery/[eventSlug]?editionId=xxx&type=photo|video&page=1&limit=24
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> }
) {
  await connectDB();
  const { eventSlug } = await params;

  const { searchParams } = new URL(request.url);
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

    // Get active attendees for navigation tabs
    const attendees = await Attendee.find({
      eventId: event._id,
    })
      .sort({ name: 1 })
      .lean();

    // Get the first active edition to display as subheading
    const mongoose = require('mongoose');
    const Edition = mongoose.models.Edition || require('@/models/Edition').default;
    const activeEdition = await Edition.findOne({ eventId: event._id, status: 'active' })
      .sort({ order: 1 })
      .lean();

    // Build media query
    const query: Record<string, unknown> = { eventId: event._id };
    if (attendeeId) query.attendeeId = attendeeId;
    if (type && (type === 'photo' || type === 'video')) query.type = type;

    const [mediaItems, totalPhotos, totalVideos] = await Promise.all([
      Media.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Media.countDocuments({ eventId: event._id, type: 'photo' }),
      Media.countDocuments({ eventId: event._id, type: 'video' }),
    ]);

    const total = await Media.countDocuments(query);

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

    // Get presigned banner URLs
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
        editionName: activeEdition?.name || null,
        desktopBannerUrl,
        mobileBannerUrl,
      },
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
