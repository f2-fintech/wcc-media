import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!;

/**
 * Generate a presigned URL to upload a file directly to S3.
 * The URL expires in 15 minutes.
 */
export async function getPresignedUploadUrl(
  key: string,
  mimeType: string,
  expiresIn = 900
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: mimeType,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generate a presigned URL to download/view a private file from S3.
 * Default expiry: 1 hour.
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete an object from S3.
 */
export async function deleteS3Object(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  await s3Client.send(command);
}

/**
 * Build S3 key for event banner images.
 */
export function buildBannerKey(
  eventId: string,
  variant: 'desktop' | 'mobile',
  fileName: string
): string {
  return `event-pics/${eventId}/banners/${variant}/${fileName}`;
}

/**
 * Build S3 key for attendee media files.
 */
export function buildMediaKey(
  eventId: string,
  editionId: string,
  attendeeId: string,
  type: 'photos' | 'videos',
  fileName: string
): string {
  return `event-pics/${eventId}/media/${editionId}/${attendeeId}/${type}/${fileName}`;
}

/**
 * Build the public S3 URL (only used server-side for storing reference).
 * The actual access always goes through presigned URLs.
 */
export function buildS3Url(key: string): string {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export { BUCKET_NAME };
export default s3Client;
