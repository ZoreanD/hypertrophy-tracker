// prisma/seed.ts
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Initialize the standard Postgres driver
const pool = new Pool({
  // Note: For seeding data (inserting rows), the pooler URL is perfectly fine to use!
  connectionString: "postgresql://neondb_owner:npg_QYEk68bytfcL@ep-restless-resonance-aqoe4fj4-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

// Wrap it in Prisma's adapter and pass it to the client
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');
// ... the rest of your seed file stays exactly the same
  // 1. Create your Admin Profile
  const myProfile = await prisma.profile.create({
    data: {
      role: 'ADMIN',
      // Update these with your actual metrics for accurate TDEE math
      birthDate: new Date('1990-01-01'), 
      heightCm: 180, // e.g., 5'11"
      gender: 'M',
      currentGoal: 'BULK', // BULK, CUT, or MAINTAIN
      weeklyGoalRate: 0.25, // kg per week
    },
  });

  console.log(`Created Profile with ID: ${myProfile.id}`);

  // 2. Populate standard Hypertrophy Exercises
  const exercises = await prisma.exercise.createMany({
    data: [
      { name: 'Barbell Bench Press', muscleGroup: 'Chest', isCompound: true },
      { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', isCompound: true },
      { name: 'Pec Deck Fly', muscleGroup: 'Chest', isCompound: false },
      { name: 'Barbell Squat', muscleGroup: 'Quads', isCompound: true },
      { name: 'Leg Extension', muscleGroup: 'Quads', isCompound: false },
      { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', isCompound: true },
      { name: 'Pull-Up', muscleGroup: 'Lats', isCompound: true },
      { name: 'Lat Pulldown', muscleGroup: 'Lats', isCompound: true },
      { name: 'Overhead Press', muscleGroup: 'Front Delts', isCompound: true },
      { name: 'Lateral Raise', muscleGroup: 'Side Delts', isCompound: false },
    ],
    skipDuplicates: true, // Prevents errors if you run the seed script twice
  });

  console.log(`Added ${exercises.count} exercises.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
