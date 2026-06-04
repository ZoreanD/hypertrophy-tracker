import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.POSTGRES_PRISMA_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Flag existing bodyweight exercises ──────────────────────────────────
  const bodyweightExercises = [
    'Push-Up',
    'Pull-Up',
    'Chin-Up',
    'Dip (Chest Variation)',
    'Dip (Triceps Variation)',
    'Glute Bridge (Bodyweight)',
    'Inverted Row',
    'Pike Push-Up',
    'Diamond Push-Up',
    'Wide Push-Up',
  ];

  for (const name of bodyweightExercises) {
    await prisma.exercise.updateMany({
      where: { name },
      data: { isBodyweight: true },
    });
    console.log(`✓ isBodyweight: ${name}`);
  }

  // ── Flag assisted exercises ─────────────────────────────────────────────
  const assistedExercises = [
    'Assisted Pull-Up Machine',
    'Assisted Triceps Dip Machine',
  ];

  for (const name of assistedExercises) {
    await prisma.exercise.updateMany({
      where: { name },
      data: { isAssisted: true },
    });
    console.log(`✓ isAssisted: ${name}`);
  }

  // ── Flag unilateral exercises ───────────────────────────────────────────
  const unilateralExercises = [
    'Kneeling Single-Arm Lat Pulldown',
    'Single-Arm Dumbbell Row',
    'Single-Arm Cable Row',
    'Dumbbell Bicep Curl',
    'Hammer Curl',
    'Cross-Body Hammer Curl',
    'Cable Hammer Curl',
    'Incline Dumbbell Curl',
    'Bayesian Cable Curl',
    'Preacher Curl (Dumbbell)',
    'Single-Arm Triceps Extension',
    'Single-Arm Cable Triceps Pushdown',
    'Cable Triceps Kickback',
    'Single-Arm Overhead Triceps Extension',
    'Dumbbell Lateral Raise',
    'Cable Lateral Raise',
    'Side Delt Cable Lateral Raise',
    'Dumbbell Rear Delt Fly',
    'Single-Arm Cable Rear Delt Fly',
    'Dumbbell Front Raise',
    'Bulgarian Split Squat',
    'Single-Leg Press',
    'Single-Leg Romanian Deadlift',
    'Single-Leg Curl',
    'Single-Leg Extension',
    'Single-Leg Calf Raise',
  ];

  for (const name of unilateralExercises) {
    const result = await prisma.exercise.updateMany({
      where: { name },
      data: { isUnilateral: true },
    });
    if (result.count > 0) console.log(`✓ isUnilateral: ${name}`);
    else console.log(`⚠ not found: ${name}`);
  }

  // ── Add missing exercises ───────────────────────────────────────────────
  const newExercises = [
    {
      name: 'EZ Bar Reverse Curl',
      primaryMuscle: 'BRACHIALIS',
      secondaryMuscles: ['BRACHIORADIALIS', 'BICEPS_LONG_HEAD'],
      equipment: 'BARBELL',
      movementPattern: 'ISOLATION',
      isUnilateral: false,
      isBodyweight: false,
      isAssisted: false,
    },
    {
      name: 'Reverse Curl (Barbell)',
      primaryMuscle: 'BRACHIALIS',
      secondaryMuscles: ['BRACHIORADIALIS', 'BICEPS_LONG_HEAD'],
      equipment: 'BARBELL',
      movementPattern: 'ISOLATION',
      isUnilateral: false,
      isBodyweight: false,
      isAssisted: false,
    },
    {
      name: 'Zottman Curl',
      primaryMuscle: 'BRACHIALIS',
      secondaryMuscles: ['BRACHIORADIALIS', 'BICEPS_LONG_HEAD', 'BICEPS_SHORT_HEAD'],
      equipment: 'DUMBBELL',
      movementPattern: 'ISOLATION',
      isUnilateral: true,
      isBodyweight: false,
      isAssisted: false,
    },
    {
      name: 'Technogym Row Machine',
      primaryMuscle: 'LATS',
      secondaryMuscles: ['RHOMBOIDS', 'TRAPS_MID', 'BICEPS_SHORT_HEAD', 'REAR_DELT'],
      equipment: 'MACHINE_SELECTORIZED',
      movementPattern: 'HORIZONTAL_PULL',
      isUnilateral: false,
      isBodyweight: false,
      isAssisted: false,
    },
    {
      name: 'Rope Hammer Curl',
      primaryMuscle: 'BRACHIALIS',
      secondaryMuscles: ['BRACHIORADIALIS', 'BICEPS_LONG_HEAD'],
      equipment: 'CABLE',
      movementPattern: 'ISOLATION',
      isUnilateral: false,
      isBodyweight: false,
      isAssisted: false,
    },
  ];

  for (const ex of newExercises) {
    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: ex,
      create: ex as any,
    });
    console.log(`✓ upserted: ${ex.name}`);
  }

  console.log('\nPatch complete.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
