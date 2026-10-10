import 'dotenv/config';
import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { prisma } from './lib/prisma.js';

const env = getEnv();
const app = createApp();

async function main() {
  try {
    await prisma.$connect();
    app.listen(env.PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`[bugnexus] API listening on http://localhost:${env.PORT}`);
      // eslint-disable-next-line no-console
      console.log(`[bugnexus] AI provider: ${env.AI_PROVIDER}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[bugnexus] Failed to start:', err);
    process.exit(1);
  }
}

main();
