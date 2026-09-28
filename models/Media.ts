import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type MediaType = 'photo' | 'video';

export interface IMedia extends Document {
  eventId: Types.ObjectId;
  editionId: Types.ObjectId;
  attendeeId: Types.ObjectId;
  type: MediaType;
  originalFileName: string;
  mimeType: string;
  size: number;
  s3Bucket: string;
  s3Key: string;
  s3Url: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number; // for videos in seconds
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    editionId: {
      type: Schema.Types.ObjectId,
      ref: 'Edition',
      required: true,
    },
    attendeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Attendee',
      required: true,
    },
    type: {
      type: String,
      enum: ['photo', 'video'],
      required: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    s3Bucket: {
      type: String,
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
    },
    s3Url: {
      type: String,
      required: true,
    },
    thumbnailKey: {
      type: String,
    },
    thumbnailUrl: {
      type: String,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    duration: {
      type: Number,
    },
  },
  { timestamps: true }
);

MediaSchema.index({ eventId: 1, editionId: 1 });
MediaSchema.index({ attendeeId: 1 });
MediaSchema.index({ eventId: 1, type: 1 });
MediaSchema.index({ createdAt: -1 });

const Media: Model<IMedia> =
  mongoose.models.Media || mongoose.model<IMedia>('Media', MediaSchema);

export default Media;
