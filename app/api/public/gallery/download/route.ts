import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Media from '@/models/Media';
import { getS3ObjectStream } from '@/lib/s3/s3.service';
import { Readable } from 'node:stream';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('mediaId');

    if (!mediaId) {
      return NextResponse.json({ error: 'mediaId is required' }, { status: 400 });
    }

    await connectDB();
    const media = await Media.findById(mediaId).lean();
    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const s3Response = await getS3ObjectStream(media.s3Key, media.s3Bucket);
    if (!s3Response || !s3Response.Body) {
      return NextResponse.json({ error: 'Failed to retrieve media file from storage' }, { status: 502 });
    }

    const originalName = media.originalFileName || 'download.jpeg';
    const cleanFileName = originalName.replace(/["\r\n]/g, '');

    // Convert Node Readable stream to Web ReadableStream
    const webStream = Readable.toWeb(s3Response.Body as Readable);

    const headers = new Headers();
    headers.set('Content-Type', media.mimeType || s3Response.ContentType || 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${cleanFileName}"; filename*=UTF-8''${encodeURIComponent(cleanFileName)}`);
    if (media.size || s3Response.ContentLength) {
      headers.set('Content-Length', String(media.size || s3Response.ContentLength));
    }
    headers.set('Cache-Control', 'public, max-age=86400');

    return new Response(webStream as any, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('GET /api/public/gallery/download error:', error);
    return NextResponse.json({ error: 'Download failed: ' + (error.message || 'Server error') }, { status: 500 });
  }
}
