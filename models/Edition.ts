import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IEdition extends Document {
  eventId: Types.ObjectId;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true }
);

EditionSchema.index({ eventId: 1, slug: 1 }, { unique: true });
EditionSchema.index({ eventId: 1, status: 1 });

const Edition: Model<IEdition> =
  mongoose.models.Edition || mongoose.model<IEdition>('Edition', EditionSchema);

export default Edition;
