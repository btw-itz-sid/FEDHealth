/** Creates one administrator from server environment; never seeds public demo accounts. */
import dataSource from './data-source';
import * as bcrypt from 'bcryptjs';
import { isEmail } from 'class-validator';
import { User, UserRole } from '../modules/users/entities/user.entity';

async function seed() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !isEmail(email) || !password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of 12 or more characters (at most 72 UTF-8 bytes)');
  }
  await dataSource.initialize();
  try {
    const repository = dataSource.getRepository(User);
    if (await repository.exists({ where: { email } })) throw new Error('An account already exists with this email; no changes made');
    await repository.save(repository.create({ email, passwordHash: await bcrypt.hash(password, 12), firstName: 'Workspace', lastName: 'Administrator', role: UserRole.ADMIN, isActive: true }));
    console.log('Administrator created. No credentials are printed.');
  } finally { await dataSource.destroy(); }
}
seed().catch(() => { console.error('Administrator setup failed. Check the environment, existing account, database connection and migrations.'); process.exitCode = 1; });
