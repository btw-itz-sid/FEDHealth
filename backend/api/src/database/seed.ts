/**
 * FedHealth — Database Seed Script
 * ==================================
 * Seeds the database with an admin user and default data.
 * Run with: npx ts-node -r tsconfig-paths/register src/database/seed.ts
 */

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../modules/users/entities/user.entity';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: '../../.env' });
config();
process.env.TZ = 'UTC';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    entities: [join(__dirname, '..', 'modules', '**', 'entities', '*.entity.{ts,js}')],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  const userRepo = dataSource.getRepository(User);

  // Seed admin user
  const existingAdmin = await userRepo.findOne({
    where: { email: 'admin@fedhealth.dev' },
  });

  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('AdminPass123!', salt);

    const admin = userRepo.create({
      email: 'admin@fedhealth.dev',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isActive: true,
      consentGiven: true,
    });

    await userRepo.save(admin);
    console.log('Created admin user: admin@fedhealth.dev / AdminPass123!');
  } else {
    console.log('Admin user already exists');
  }

  // Seed researcher user
  const existingResearcher = await userRepo.findOne({
    where: { email: 'researcher@fedhealth.dev' },
  });

  if (!existingResearcher) {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('ResearchPass123!', salt);

    const researcher = userRepo.create({
      email: 'researcher@fedhealth.dev',
      passwordHash,
      firstName: 'Research',
      lastName: 'User',
      role: UserRole.RESEARCHER,
      isActive: true,
      consentGiven: true,
    });

    await userRepo.save(researcher);
    console.log('Created researcher: researcher@fedhealth.dev / ResearchPass123!');
  } else {
    console.log('Researcher user already exists');
  }

  // Seed patient user
  const existingPatient = await userRepo.findOne({
    where: { email: 'patient@fedhealth.dev' },
  });

  if (!existingPatient) {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('PatientPass123!', salt);

    const patient = userRepo.create({
      email: 'patient@fedhealth.dev',
      passwordHash,
      firstName: 'Patient',
      lastName: 'Demo',
      role: UserRole.PATIENT,
      isActive: true,
      consentGiven: true,
    });

    await userRepo.save(patient);
    console.log('Created patient: patient@fedhealth.dev / PatientPass123!');
  } else {
    console.log('Patient user already exists');
  }

  await dataSource.destroy();
  console.log('Seed complete');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
