import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAttendee extends Document {
  eventId: Types.ObjectId;
  name: string;
  email?: string;
  normalizedEmail?: string;
  downloadPin?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendeeSchema = new Schema<IAttendee>(
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
    email: {
      type: String,
      trim: true,
    },
    normalizedEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    downloadPin: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

AttendeeSchema.index({ eventId: 1, normalizedEmail: 1 });
AttendeeSchema.index({ normalizedEmail: 1 });

const Attendee: Model<IAttendee> =
  mongoose.models.Attendee ||
  mongoose.model<IAttendee>('Attendee', AttendeeSchema);

export default Attendee;
