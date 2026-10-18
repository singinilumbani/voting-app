import { performance } from 'node:perf_hooks';
import { loadConfig } from '../src/config/env.js';
import { Pbkdf2PasswordHasher } from '../src/services/password-hasher.js';
import { base64urlEncode, randomBytes } from '../src/shared/crypto/encoding.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const hasher = new Pbkdf2PasswordHasher(config.passwordHashIterations);
  const benchmarkPassword = base64urlEncode(randomBytes(32));
  const samples: number[] = [];
  for (let sample = 0; sample < 5; sample += 1) {
    const start = performance.now();
    await hasher.hash(benchmarkPassword);
    samples.push(performance.now() - start);
  }
  samples.sort((left, right) => left - right);
  const medianMs = samples[Math.floor(samples.length / 2)];
  console.info(
    JSON.stringify({
      event: 'password_hash_benchmark',
      algorithm: 'PBKDF2-SHA256',
      iterations: config.passwordHashIterations,
      samples: samples.length,
      medianMs: Number(medianMs?.toFixed(2))
    })
  );
}

main().catch((error: unknown) => {
  console.error('Password hash benchmark failed');
  console.error(error);
  process.exitCode = 1;
});
