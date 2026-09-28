import mongoose from 'mongoose';
import Attendee from './models/Attendee.js';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const attendees = await Attendee.find({});
  console.log('Attendees:', attendees.map(a => ({ id: a._id, name: a.name, downloadPin: a.downloadPin })));
  process.exit(0);
}
check();
