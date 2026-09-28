import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Media from '@/models/Media';
import Attendee from '@/models/Attendee';
import { requireAdminAuth } from '@/lib/auth/auth';
import {
  getPresignedUploadUrl,
  buildMediaKey,
  buildS3Url,
  BUCKET_NAME,
} from '@/lib/s3/s3.service';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/mov',
  'video/quicktime',
  'video/avi',
  'video/webm',
];

const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

// POST /api/uploads/presign - get presigned upload URLs
export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  try {
    const body = await request.json();
    const { eventId, editionId, attendeeId, files } = body;

    if (!eventId || !editionId || !attendeeId || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'eventId, editionId, attendeeId and files are required.' },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      files.map(async (file: { name: string; type: string; size: number }) => {
        const { name, type, size } = file;

        const isImage = ALLOWED_IMAGE_TYPES.includes(type);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(type);

        if (!isImage && !isVideo) {
          return {
            name,
            error: `File type ${type} is not allowed.`,
            success: false,
          };
        }

        if (isImage && size > MAX_IMAGE_SIZE) {
          return {
            name,
            error: `Image file too large. Maximum is 50 MB.`,
            success: false,
          };
        }

        if (isVideo && size > MAX_VIDEO_SIZE) {
          return {
            name,
            error: `Video file too large. Maximum is 2 GB.`,
            success: false,
          };
        }

        const mediaType = isImage ? 'photo' : 'video';
        const folder = isImage ? 'photos' : 'videos';
        const ext = name.split('.').pop() || '';
        const uniqueName = `${uuidv4()}.${ext}`;
        const s3Key = buildMediaKey(eventId, editionId, attendeeId, folder, uniqueName);

        const presignedUrl = await getPresignedUploadUrl(s3Key, type, 900);
        const s3Url = buildS3Url(s3Key);

        // Pre-create the media record (will be confirmed after upload)
        const mediaDoc = await Media.create({
          eventId,
          editionId,
          attendeeId,
          type: mediaType,
          originalFileName: name,
          mimeType: type,
          size,
          s3Bucket: BUCKET_NAME,
          s3Key,
          s3Url,
        });

        return {
          name,
          success: true,
          mediaId: mediaDoc._id.toString(),
          presignedUrl,
          s3Key,
          mediaType,
        };
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('POST /api/uploads/presign error:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URLs.' },
      { status: 500 }
    );
  }
}
