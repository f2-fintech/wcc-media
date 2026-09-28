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
    const { name, email, eventSlug } = body;

    if (!name || !email || !eventSlug) {
      return NextResponse.json(
        { error: 'Name, email and eventSlug are required.' },
        { status: 400 }
      );
    }

    // Find the event by slug
    const event = await Event.findOne({ slug: eventSlug.toLowerCase().trim() });
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find attendee - use case-insensitive name match + normalized email
    const attendee = await Attendee.findOne({
      eventId: event._id,
      normalizedEmail,
    });

    if (!attendee) {
      // Do not reveal whether the account exists
      return NextResponse.json({ found: false, media: [] });
    }

    // Fetch their media
    const mediaItems = await Media.find({ attendeeId: attendee._id })
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
        name: attendee.name,
        // Do not return email or internal IDs
      },
      media: mediaWithUrls,
    });
  } catch (error) {
    console.error('POST /api/attendees/lookup error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
