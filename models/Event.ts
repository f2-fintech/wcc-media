import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBannerImage {
  s3Bucket: string;
  s3Key: string;
  s3Url: string;
  uploadedAt: Date;
}

export interface IEvent extends Document {
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  desktopBanner?: IBannerImage;
  mobileBanner?: IBannerImage;
  createdAt: Date;
  updatedAt: Date;
}

const BannerImageSchema = new Schema<IBannerImage>(
  {
    s3Bucket: { type: String, required: true },
    s3Key: { type: String, required: true },
    s3Url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const EventSchema = new Schema<IEvent>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    desktopBanner: {
      type: BannerImageSchema,
      default: null,
    },
    mobileBanner: {
      type: BannerImageSchema,
      default: null,
    },
  },
  { timestamps: true }
);

EventSchema.index({ slug: 1 }, { unique: true });

const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);

export default Event;
