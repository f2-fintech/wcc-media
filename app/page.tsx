import type { Metadata } from 'next';
import connectDB from '@/lib/mongodb/connect';
import Event from '@/models/Event';
import Edition from '@/models/Edition';
import Media from '@/models/Media';
import EventPortalClient, { EventItemData } from './EventPortalClient';

export const metadata: Metadata = {
  title: '1F2 | Curated Events & Gallery Portal',
  description: 'Official digital showcase of corporate milestones, celebrations, and events across 1F2.',
};

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let eventsList: EventItemData[] = [];

  try {
    await connectDB();

    const rawEvents = await Event.find({ active: { $ne: false } })
      .sort({ createdAt: -1 })
      .lean();

    eventsList = await Promise.all(
      rawEvents.map(async (ev) => {
        const eventId = ev._id;

        // Fetch counts for this event
        const [mediaCount, editionCount, sampleMedia] = await Promise.all([
          Media.countDocuments({ eventId }),
          Edition.countDocuments({ eventId }),
          !ev.desktopBanner?.s3Url
            ? Media.findOne({ eventId })
                .select('thumbnailUrl s3Url')
                .lean()
            : Promise.resolve(null),
        ]);

        const coverImage =
          ev.desktopBanner?.s3Url ||
          ev.mobileBanner?.s3Url ||
          sampleMedia?.thumbnailUrl ||
          sampleMedia?.s3Url ||
          null;

        return {
          id: (eventId as { toString(): string }).toString(),
          name: ev.name,
          slug: ev.slug,
          description: ev.description || '',
          coverImage,
          mediaCount,
          editionCount,
          active: ev.active !== false,
          createdAt: ev.createdAt ? new Date(ev.createdAt).toISOString() : undefined,
        };
      })
    );
  } catch (error) {
    console.error('Error loading events for homepage:', error);
  }

  return <EventPortalClient events={eventsList} />;
}
