import { defineConfig } from '@prisma/config';

export default defineConfig({
    migrations: {
    // This tells Prisma to use the ts-node package we just installed to run the seed file
    seed: 'npx ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
  datasource: {
    // Paste your actual Vercel Postgres URL right here inside the quotes
    url: "postgresql://neondb_owner:npg_QYEk68bytfcL@ep-restless-resonance-aqoe4fj4.c-8.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require&connect_timeout=30",
  },
});
