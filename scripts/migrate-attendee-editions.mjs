import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('No MONGODB_URI found.');
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const attendeesCollection = mongoose.connection.collection('attendees');
  const mediaCollection = mongoose.connection.collection('media');
  const editionsCollection = mongoose.connection.collection('editions');

  const attendees = await attendeesCollection.find().toArray();
  console.log(`Found ${attendees.length} attendees.`);

  let updatedCount = 0;
  for (const a of attendees) {
    if (!a.editionId) {
      // Find media to get editionId
      const media = await mediaCollection.findOne({ attendeeId: a._id });
      let editionId = media ? media.editionId : null;
      if (!editionId) {
        const firstEdition = await editionsCollection.findOne({ eventId: a.eventId });
        if (firstEdition) editionId = firstEdition._id;
      }

      if (editionId) {
        await attendeesCollection.updateOne(
          { _id: a._id },
          { $set: { editionId } }
        );
        console.log(`Updated attendee "${a.name}" (${a._id}) -> editionId: ${editionId}`);
        updatedCount++;
      } else {
        console.warn(`Could not determine editionId for attendee "${a.name}" (${a._id})`);
      }
    } else {
      console.log(`Attendee "${a.name}" already has editionId: ${a.editionId}`);
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} attendees.`);
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
