import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IBannerImage {
  s3Bucket: string;
  s3Key: string;
  s3Url: string;
  uploadedAt: Date;
}

export interface IEdition extends Document {
  eventId: Types.ObjectId;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  order: number;
  desktopBanner?: IBannerImage | null;
  mobileBanner?: IBannerImage | null;
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

const EditionSchema = new Schema<IEdition>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    order: {
      type: Number,
      default: 0,
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

EditionSchema.index({ eventId: 1, slug: 1 }, { unique: true });
EditionSchema.index({ eventId: 1, status: 1 });

const Edition: Model<IEdition> =
  mongoose.models.Edition || mongoose.model<IEdition>('Edition', EditionSchema);

export default Edition;
