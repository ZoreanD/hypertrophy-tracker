import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding baseline exercises...');

  const exercises = [
    { name: 'Barbell Bench Press', muscleGroup: 'Chest', isCompound: true },
    { name: 'Squat', muscleGroup: 'Legs', isCompound: true },
    { name: 'Deadlift', muscleGroup: 'Back', isCompound: true },
    { name: 'Overhead Press', muscleGroup: 'Shoulders', isCompound: true },
    { name: 'Pull-up', muscleGroup: 'Back', isCompound: true },
    { name: 'Dumbbell Curl', muscleGroup: 'Biceps', isCompound: false },
    { name: 'Triceps Extension', muscleGroup: 'Triceps', isCompound: false },
    { name: 'Leg Extension', muscleGroup: 'Legs', isCompound: false },
    { name: 'Leg Curl', muscleGroup: 'Legs', isCompound: false },
    { name: 'Lateral Raise', muscleGroup: 'Shoulders', isCompound: false },
  ];

  // Upsert ensures we don't create duplicates if the seed script runs multiple times
  for (const ex of exercises) {
    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: {},
      create: ex,
    });
  }

  console.log('Exercises seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });