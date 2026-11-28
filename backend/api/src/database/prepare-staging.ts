import dataSource from './data-source';
import { User, UserRole } from '../modules/users/entities/user.entity';
import { isEmail } from 'class-validator';
import * as bcrypt from 'bcryptjs';

async function prepare() {
  if (process.env.NODE_ENV !== 'production') throw new Error('Staging bootstrap requires production mode');
  await dataSource.initialize();
  try {
    await dataSource.runMigrations({ transaction: 'all' });
    const users = dataSource.getRepository(User);
    if (!await users.exists({ where: { role: UserRole.ADMIN, isActive: true } })) {
      const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD;
      if (!email || !isEmail(email) || !password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Initial administrator configuration is missing or invalid');
      if (await users.exists({ where: { email } })) throw new Error('Bootstrap cannot promote an existing account');
      await users.save(users.create({ email, passwordHash: await bcrypt.hash(password, 12), firstName: 'Workspace', lastName: 'Administrator', role: UserRole.ADMIN }));
      console.log('Initial administrator created; credentials are never printed.');
    }
  } finally { await dataSource.destroy(); }
}
prepare().catch(error => { console.error('Staging database preparation failed:', error.name, error.code || 'check-migrations-and-admin-configuration'); process.exitCode = 1; });
