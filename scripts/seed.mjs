#!/usr/bin/env node
/**
 * Seed script for initial data setup.
 * Run with: node --env-file=.env.local scripts/seed.mjs
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || 'admin@whitecoatclub.com';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'ChangeMe123!';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined. Check your .env.local file.');
  process.exit(1);
}

// Inline schemas for the seed script
const AdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'admin' },
}, { timestamps: true });

const EventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: String,
  active: { type: Boolean, default: true },
  desktopBanner: Object,
  mobileBanner: Object,
}, { timestamps: true });

const EditionSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, lowercase: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  order: { type: Number, default: 0 },
}, { timestamps: true });

const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);
const Edition = mongoose.models.Edition || mongoose.model('Edition', EditionSchema);

async function seed() {
  console.log('🌱 Starting seed...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Create admin
  const existingAdmin = await Admin.findOne({ email: ADMIN_EMAIL });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await Admin.create({ email: ADMIN_EMAIL, passwordHash, role: 'superadmin' });
    console.log(`✅ Admin created: ${ADMIN_EMAIL}`);
  } else {
    console.log(`ℹ️  Admin already exists: ${ADMIN_EMAIL}`);
  }

  // Create White Coat Club event
  let event = await Event.findOne({ slug: 'white-coat-club' });
  if (!event) {
    event = await Event.create({
      name: 'WHITE COAT CLUB',
      slug: 'white-coat-club',
      description: 'An exclusive gathering of medical professionals, celebrating excellence in medicine.',
      active: true,
    });
    console.log('✅ Event created: WHITE COAT CLUB');
  } else {
    console.log('ℹ️  Event already exists: WHITE COAT CLUB');
  }

  // Create editions
  const editions = [
    { name: 'White Coat Club 2026', slug: 'white-coat-club-2026', order: 0 },
    { name: 'Pre-Event', slug: 'pre-event', order: 1 },
    { name: 'Main Event', slug: 'main-event', order: 2 },
    { name: 'After Party', slug: 'after-party', order: 3 },
  ];

  for (const ed of editions) {
    const existing = await Edition.findOne({ eventId: event._id, slug: ed.slug });
    if (!existing) {
      await Edition.create({ eventId: event._id, ...ed, status: 'active' });
      console.log(`✅ Edition created: ${ed.name}`);
    } else {
      console.log(`ℹ️  Edition already exists: ${ed.name}`);
    }
  }

  console.log('\n🎉 Seed complete!');
  console.log(`\n📋 Admin credentials:`);
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`\n⚠️  Change the admin password after first login!`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
