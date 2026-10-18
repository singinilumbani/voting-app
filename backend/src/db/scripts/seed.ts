import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { loadConfig } from '../../config/env.js';
import { Pbkdf2PasswordHasher } from '../../services/password-hasher.js';
import { createDbClient } from '../factory.js';
import { pollingStations } from '../schema/polling-stations.js';
import { users } from '../schema/users.js';

const seedEnvironmentSchema = z.object({
  DEMO_HOST_EMAIL: z.string().email().default('demo-host@example.test'),
  DEMO_HOST_PASSWORD: z.string().min(12).max(256)
});

function createPublicId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function main(): Promise<void> {
  const { DEMO_HOST_EMAIL, DEMO_HOST_PASSWORD } = seedEnvironmentSchema.parse(process.env);
  const demoHostEmail = DEMO_HOST_EMAIL.trim().toLowerCase();
  const config = loadConfig(process.env);
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to seed the database');
  }
  const passwordHash = await new Pbkdf2PasswordHasher(config.passwordHashIterations).hash(
    DEMO_HOST_PASSWORD
  );
  const emailVerifiedAt = new Date();

  const client = await createDbClient(config);
  async function findOrCreateStation(
    hostId: string,
    name: string,
    mode: 'PUBLIC_POLL' | 'CLOSED_VOTE',
    voterCap: number
  ): Promise<void> {
    const existing = await client.db
      .select({ id: pollingStations.id })
      .from(pollingStations)
      .where(and(eq(pollingStations.hostId, hostId), eq(pollingStations.name, name)))
      .limit(1);
    if (existing.length > 0) {
      return;
    }

    await client.db.insert(pollingStations).values({
      publicId: createPublicId(),
      hostId,
      name,
      mode,
      voterCap
    });
  }

  try {
    const host = await client.db
      .insert(users)
      .values({
        username: 'demo-host',
        passwordHash,
        email: demoHostEmail,
        accountType: 'LONG_TERM',
        plan: 'FREE',
        emailVerifiedAt
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { username: 'demo-host', passwordHash, emailVerifiedAt }
      })
      .returning({ id: users.id });
    const demoHost = host[0];
    if (!demoHost) {
      throw new Error('Failed to create demo host');
    }

    await findOrCreateStation(demoHost.id, 'Demo Closed Vote', 'CLOSED_VOTE', 500);
    await findOrCreateStation(demoHost.id, 'Demo Public Poll', 'PUBLIC_POLL', 2500);
  } finally {
    await client.close();
  }
}

main();
