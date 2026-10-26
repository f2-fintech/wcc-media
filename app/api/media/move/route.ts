import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb/connect';
import Media from '@/models/Media';
import Attendee from '@/models/Attendee';
import Edition from '@/models/Edition';
import { requireAdminAuth } from '@/lib/auth/auth';

// POST /api/media/move
// Body:
// {
//   mediaIds: string[],
//   targetFolderId?: string,
//   newFolder?: {
//     eventId: string,
//     editionId: string,
//     name: string,
//     email?: string,
//     downloadPin?: string,
//   }
// }
export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth instanceof NextResponse) return auth;

  await connectDB();

  try {
    const body = await request.json();
    const { mediaIds, targetFolderId, newFolder } = body;

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return NextResponse.json(
        { error: 'mediaIds array is required and must not be empty.' },
        { status: 400 }
      );
    }

    let finalFolderId = targetFolderId;

    // If newFolder details provided, create or find the folder
    if (newFolder) {
      const { eventId, editionId, name, email, downloadPin } = newFolder;
      if (!eventId || !editionId || !name || !name.trim()) {
        return NextResponse.json(
          { error: 'eventId, editionId, and folder name are required to create a new folder.' },
          { status: 400 }
        );
      }

      const trimmedName = name.trim();
      const normalizedEmail = email ? email.toLowerCase().trim() : undefined;
      const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      let attendee = await Attendee.findOne({
        eventId,
        editionId,
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      });

      if (!attendee && normalizedEmail) {
        attendee = await Attendee.findOne({
          eventId,
          editionId,
          normalizedEmail,
        });
      }

      if (!attendee) {
        attendee = await Attendee.create({
          eventId,
          editionId,
          name: trimmedName,
          ...(email && { email: email.trim() }),
          ...(normalizedEmail && { normalizedEmail }),
          ...(downloadPin && { downloadPin: downloadPin.trim() }),
        });
      }

      finalFolderId = attendee._id.toString();
    }

    if (!finalFolderId) {
      return NextResponse.json(
        { error: 'Either targetFolderId or newFolder configuration must be provided.' },
        { status: 400 }
      );
    }

    // Verify target folder exists
    const targetFolder = await Attendee.findById(finalFolderId);
    if (!targetFolder) {
      return NextResponse.json(
        { error: 'Target folder not found.' },
        { status: 404 }
      );
    }

    const updateFields: Record<string, unknown> = {
      attendeeId: targetFolder._id,
      eventId: targetFolder.eventId,
    };
    if (targetFolder.editionId) {
      updateFields.editionId = targetFolder.editionId;
    }

    const result = await Media.updateMany(
      { _id: { $in: mediaIds } },
      { $set: updateFields }
    );

    return NextResponse.json({
      success: true,
      movedCount: result.modifiedCount,
      targetFolder: {
        _id: targetFolder._id,
        name: targetFolder.name,
      },
    });
  } catch (error) {
    console.error('POST /api/media/move error:', error);
    return NextResponse.json({ error: 'Failed to move media.' }, { status: 500 });
  }
}
