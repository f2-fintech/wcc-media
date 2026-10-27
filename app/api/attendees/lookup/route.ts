import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Attendee from '@/models/Attendee';
import Media from '@/models/Media';
import Event from '@/models/Event';
import { getPresignedDownloadUrl } from '@/lib/s3/s3.service';

// POST /api/attendees/lookup - public endpoint for "My Photos"
export async function POST(request: NextRequest) {
  await connectDB();

  try {
    const body = await request.json();
    const { name, eventSlug } = body;

    if (!name || typeof name !== 'string' || !name.trim() || !eventSlug) {
      return NextResponse.json(
        { error: 'Name and eventSlug are required.' },
        { status: 400 }
      );
    }

    // Find the event by slug
    const event = await Event.findOne({ slug: eventSlug.toLowerCase().trim() });
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const trimmedName = name.trim();
    const escaped = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanCore = trimmedName.replace(/^dr\.?\s+/i, '').trim();
    const escapedCore = cleanCore ? cleanCore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;

    // Search matching attendees under this event
    const searchConditions: any[] = [
      { name: { $regex: new RegExp(`^${escaped}$`, 'i') } },
      { name: { $regex: new RegExp(`\\b${escaped}\\b`, 'i') } },
      { name: { $regex: new RegExp(escaped, 'i') } },
    ];

    if (escapedCore) {
      searchConditions.push(
        { name: { $regex: new RegExp(`^dr\\.?\\s*${escapedCore}$`, 'i') } },
        { name: { $regex: new RegExp(escapedCore, 'i') } }
      );
    }

    const matchingAttendees = await Attendee.find({
      eventId: event._id,
      $or: searchConditions,
    }).lean();

    if (!matchingAttendees || matchingAttendees.length === 0) {
      return NextResponse.json({ found: false, media: [] });
    }

    const attendeeIds = matchingAttendees.map((a) => a._id);
    const primaryName = matchingAttendees[0].name;

    // Fetch their media across all matching folders
    const mediaItems = await Media.find({ attendeeId: { $in: attendeeIds } })
      .sort({ createdAt: -1 })
      .lean();

    // Generate presigned URLs for each item
    const mediaWithUrls = await Promise.all(
      mediaItems.map(async (item) => {
        const viewUrl = await getPresignedDownloadUrl(item.s3Key, 3600);
        const thumbnailUrl = item.thumbnailKey
          ? await getPresignedDownloadUrl(item.thumbnailKey, 3600)
          : viewUrl;
        return {
          _id: item._id,
          type: item.type,
          originalFileName: item.originalFileName,
          size: item.size,
          mimeType: item.mimeType,
          viewUrl,
          thumbnailUrl,
          createdAt: item.createdAt,
        };
      })
    );

    return NextResponse.json({
      found: true,
      attendee: {
        name: primaryName,
        // Do not return email or internal IDs
      },
      media: mediaWithUrls,
    });
  } catch (error) {
    console.error('POST /api/attendees/lookup error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
