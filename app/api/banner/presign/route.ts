import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Event from '@/models/Event';
import { requireAdminAuth } from '@/lib/auth/auth';
import {
  getPresignedUploadUrl,
  buildBannerKey,
  buildS3Url,
  deleteS3Object,
  BUCKET_NAME,
} from '@/lib/s3/s3.service';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_BANNER_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BANNER_SIZE = 20 * 1024 * 1024; // 20 MB

// POST /api/banner/presign - get presigned URL for banner upload
export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  try {
    const body = await request.json();
    const { eventId, variant, fileName, fileType, fileSize } = body;

    if (!eventId || !variant || !fileName || !fileType) {
      return NextResponse.json(
        { error: 'eventId, variant, fileName and fileType are required.' },
        { status: 400 }
      );
    }

    if (!['desktop', 'mobile'].includes(variant)) {
      return NextResponse.json({ error: 'variant must be desktop or mobile.' }, { status: 400 });
    }

    if (!ALLOWED_BANNER_TYPES.includes(fileType)) {
      return NextResponse.json({ error: 'Invalid file type for banner.' }, { status: 400 });
    }

    if (fileSize && fileSize > MAX_BANNER_SIZE) {
      return NextResponse.json({ error: 'Banner file too large. Max 20 MB.' }, { status: 400 });
    }

    const ext = fileName.split('.').pop() || 'jpg';
    const uniqueName = `${uuidv4()}.${ext}`;
    const s3Key = buildBannerKey(eventId, variant as 'desktop' | 'mobile', uniqueName);
    const presignedUrl = await getPresignedUploadUrl(s3Key, fileType, 900);
    const s3Url = buildS3Url(s3Key);

    return NextResponse.json({ presignedUrl, s3Key, s3Url, s3Bucket: BUCKET_NAME });
  } catch (error) {
    console.error('POST /api/banner/presign error:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL.' }, { status: 500 });
  }
}
