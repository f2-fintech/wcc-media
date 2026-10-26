import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Event from '@/models/Event';
import Edition from '@/models/Edition';
import { requireAdminAuth } from '@/lib/auth/auth';
import { deleteS3Object, getPresignedDownloadUrl } from '@/lib/s3/s3.service';

// PATCH /api/banner/[eventId] - save banner reference after upload (event or edition)
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
    const { variant, s3Bucket, s3Key, s3Url, editionId } = body;

    if (!variant || !s3Bucket || !s3Key || !s3Url) {
      return NextResponse.json({ error: 'variant, s3Bucket, s3Key and s3Url are required.' }, { status: 400 });
    }

    const bannerData = { s3Bucket, s3Key, s3Url, uploadedAt: new Date() };

    if (editionId) {
      const edition = await Edition.findById(editionId);
      if (!edition) {
        return NextResponse.json({ error: 'Edition not found.' }, { status: 404 });
      }

      // Delete old banner from S3 if it exists
      const oldBanner = variant === 'desktop' ? edition.desktopBanner : edition.mobileBanner;
      if (oldBanner?.s3Key) {
        await deleteS3Object(oldBanner.s3Key).catch(() => {});
      }

      if (variant === 'desktop') {
        edition.desktopBanner = bannerData;
      } else {
        edition.mobileBanner = bannerData;
      }

      await edition.save();
      return NextResponse.json({ success: true, edition });
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

// DELETE /api/banner/[eventId]?variant=desktop|mobile&editionId=xxx
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
    const editionId = searchParams.get('editionId');

    if (!variant || !['desktop', 'mobile'].includes(variant)) {
      return NextResponse.json({ error: 'variant must be desktop or mobile.' }, { status: 400 });
    }

    if (editionId) {
      const edition = await Edition.findById(editionId);
      if (!edition) {
        return NextResponse.json({ error: 'Edition not found.' }, { status: 404 });
      }

      const banner = variant === 'desktop' ? edition.desktopBanner : edition.mobileBanner;
      if (banner?.s3Key) {
        await deleteS3Object(banner.s3Key).catch(() => {});
      }

      if (variant === 'desktop') {
        edition.desktopBanner = null;
      } else {
        edition.mobileBanner = null;
      }

      await edition.save();
      return NextResponse.json({ success: true });
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

// GET /api/banner/[eventId]?editionId=xxx - get presigned banner URL
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  await connectDB();
  const { eventId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const editionId = searchParams.get('editionId');

    const event = await Event.findById(eventId).lean();
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
    }

    const result: Record<string, any> = {
      desktopBannerUrl: null,
      mobileBannerUrl: null,
      hasCustomBanner: false,
      isFallback: false,
    };

    if (editionId) {
      const edition = await Edition.findById(editionId).lean();
      if (!edition) {
        return NextResponse.json({ error: 'Edition not found.' }, { status: 404 });
      }

      const hasCustomDesktop = Boolean(edition.desktopBanner?.s3Key);
      const hasCustomMobile = Boolean(edition.mobileBanner?.s3Key);
      result.hasCustomBanner = hasCustomDesktop || hasCustomMobile;
      result.hasCustomDesktop = hasCustomDesktop;
      result.hasCustomMobile = hasCustomMobile;

      if (hasCustomDesktop) {
        result.desktopBannerUrl = await getPresignedDownloadUrl(edition.desktopBanner!.s3Key, 3600);
        result.isDesktopFallback = false;
      } else if (event.desktopBanner?.s3Key) {
        result.desktopBannerUrl = await getPresignedDownloadUrl(event.desktopBanner.s3Key, 3600);
        result.isDesktopFallback = true;
        result.isFallback = true;
      }

      if (hasCustomMobile) {
        result.mobileBannerUrl = await getPresignedDownloadUrl(edition.mobileBanner!.s3Key, 3600);
        result.isMobileFallback = false;
      } else if (event.mobileBanner?.s3Key) {
        result.mobileBannerUrl = await getPresignedDownloadUrl(event.mobileBanner.s3Key, 3600);
        result.isMobileFallback = true;
        result.isFallback = true;
      }

      result.editionName = edition.name;
      return NextResponse.json(result);
    }

    if (event.desktopBanner?.s3Key) {
      result.desktopBannerUrl = await getPresignedDownloadUrl(event.desktopBanner.s3Key, 3600);
      result.hasCustomBanner = true;
    }
    if (event.mobileBanner?.s3Key) {
      result.mobileBannerUrl = await getPresignedDownloadUrl(event.mobileBanner.s3Key, 3600);
      result.hasCustomBanner = true;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/banner/[eventId] error:', error);
    return NextResponse.json({ error: 'Failed to get banner.' }, { status: 500 });
  }
}
