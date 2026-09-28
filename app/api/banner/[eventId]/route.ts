import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Event from '@/models/Event';
import { requireAdminAuth } from '@/lib/auth/auth';
import { deleteS3Object, getPresignedDownloadUrl } from '@/lib/s3/s3.service';

// PATCH /api/banner/[eventId] - save banner reference after upload
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();
  const { eventId } = await params;

  try {
    const body = await request.json();
    const { variant, s3Bucket, s3Key, s3Url } = body;

    if (!variant || !s3Bucket || !s3Key || !s3Url) {
      return NextResponse.json({ error: 'variant, s3Bucket, s3Key and s3Url are required.' }, { status: 400 });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    // Delete old banner from S3 if it exists
    const oldBanner = variant === 'desktop' ? event.desktopBanner : event.mobileBanner;
    if (oldBanner?.s3Key) {
      await deleteS3Object(oldBanner.s3Key).catch(() => {});
    }

    const bannerData = { s3Bucket, s3Key, s3Url, uploadedAt: new Date() };

    if (variant === 'desktop') {
      event.desktopBanner = bannerData;
    } else {
      event.mobileBanner = bannerData;
    }

    await event.save();

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('PATCH /api/banner/[eventId] error:', error);
    return NextResponse.json({ error: 'Failed to update banner.' }, { status: 500 });
  }
}

// DELETE /api/banner/[eventId]?variant=desktop|mobile
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();
  const { eventId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const variant = searchParams.get('variant');

    if (!variant || !['desktop', 'mobile'].includes(variant)) {
      return NextResponse.json({ error: 'variant must be desktop or mobile.' }, { status: 400 });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const banner = variant === 'desktop' ? event.desktopBanner : event.mobileBanner;
    if (banner?.s3Key) {
      await deleteS3Object(banner.s3Key).catch(() => {});
    }

    if (variant === 'desktop') {
      event.desktopBanner = undefined;
    } else {
      event.mobileBanner = undefined;
    }

    await event.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/banner/[eventId] error:', error);
    return NextResponse.json({ error: 'Failed to delete banner.' }, { status: 500 });
  }
}

// GET /api/banner/[eventId] - get presigned banner URL (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  await connectDB();
  const { eventId } = await params;

  try {
    const event = await Event.findById(eventId).lean();
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const result: Record<string, string | null> = {
      desktopBannerUrl: null,
      mobileBannerUrl: null,
    };

    if (event.desktopBanner?.s3Key) {
      result.desktopBannerUrl = await getPresignedDownloadUrl(event.desktopBanner.s3Key, 3600);
    }
    if (event.mobileBanner?.s3Key) {
      result.mobileBannerUrl = await getPresignedDownloadUrl(event.mobileBanner.s3Key, 3600);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/banner/[eventId] error:', error);
    return NextResponse.json({ error: 'Failed to get banner.' }, { status: 500 });
  }
}
