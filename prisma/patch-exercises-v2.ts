import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.POSTGRES_PRISMA_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const newExercises = [
    { name: 'Close-Grip Bench Press', primaryMuscle: 'TRICEPS_MEDIAL_HEAD', secondaryMuscles: ['TRICEPS_LATERAL_HEAD', 'TRICEPS_LONG_HEAD', 'CHEST_MID_LOWER', 'FRONT_DELT'], equipment: 'BARBELL', movementPattern: 'HORIZONTAL_PUSH', isUnilateral: false, isBodyweight: false, isAssisted: false },
    { name: 'Close-Grip Dumbbell Press', primaryMuscle: 'TRICEPS_MEDIAL_HEAD', secondaryMuscles: ['TRICEPS_LATERAL_HEAD', 'TRICEPS_LONG_HEAD', 'CHEST_MID_LOWER'], equipment: 'DUMBBELL', movementPattern: 'HORIZONTAL_PUSH', isUnilateral: false, isBodyweight: false, isAssisted: false },
    { name: 'Cable Hip Abduction', primaryMuscle: 'GLUTE_MED', secondaryMuscles: ['HIP_ABDUCTOR'], equipment: 'CABLE', movementPattern: 'ISOLATION', isUnilateral: true, isBodyweight: false, isAssisted: false },
    { name: 'Side-Lying Hip Abduction', primaryMuscle: 'GLUTE_MED', secondaryMuscles: ['HIP_ABDUCTOR'], equipment: 'BODYWEIGHT', movementPattern: 'ISOLATION', isUnilateral: true, isBodyweight: true, isAssisted: false },
    { name: 'Machine Hip Abduction', primaryMuscle: 'GLUTE_MED', secondaryMuscles: ['HIP_ABDUCTOR', 'GLUTE_MAX'], equipment: 'MACHINE_SELECTORIZED', movementPattern: 'ISOLATION', isUnilateral: false, isBodyweight: false, isAssisted: false },
    { name: 'Cable Woodchop', primaryMuscle: 'OBLIQUES', secondaryMuscles: ['ABS'], equipment: 'CABLE', movementPattern: 'ISOLATION', isUnilateral: true, isBodyweight: false, isAssisted: false },
    { name: 'Hanging Oblique Knee Raise', primaryMuscle: 'OBLIQUES', secondaryMuscles: ['ABS', 'HIP_ABDUCTOR'], equipment: 'BODYWEIGHT', movementPattern: 'ISOLATION', isUnilateral: false, isBodyweight: true, isAssisted: false },
    { name: 'Back Extension (45 Degree)', primaryMuscle: 'LOWER_BACK', secondaryMuscles: ['GLUTE_MAX', 'HAMSTRING_BICEPS_FEMORIS'], equipment: 'BODYWEIGHT', movementPattern: 'HINGE', isUnilateral: false, isBodyweight: true, isAssisted: false },
    { name: 'Reverse Hyperextension', primaryMuscle: 'LOWER_BACK', secondaryMuscles: ['GLUTE_MAX', 'HAMSTRING_MEDIAL'], equipment: 'MACHINE_SELECTORIZED', movementPattern: 'HINGE', isUnilateral: false, isBodyweight: false, isAssisted: false },
    { name: 'Incline Dumbbell Curl (45 Degree)', primaryMuscle: 'BICEPS_LONG_HEAD', secondaryMuscles: ['BICEPS_SHORT_HEAD'], equipment: 'DUMBBELL', movementPattern: 'ISOLATION', isUnilateral: true, isBodyweight: false, isAssisted: false },
    { name: 'Behind-Body Cable Curl', primaryMuscle: 'BICEPS_LONG_HEAD', secondaryMuscles: ['BICEPS_SHORT_HEAD', 'BRACHIALIS'], equipment: 'CABLE', movementPattern: 'ISOLATION', isUnilateral: true, isBodyweight: false, isAssisted: false },
    { name: 'Behind-the-Back Cable Lateral Raise', primaryMuscle: 'SIDE_DELT', secondaryMuscles: ['FRONT_DELT', 'TRAPS_UPPER'], equipment: 'CABLE', movementPattern: 'ISOLATION', isUnilateral: true, isBodyweight: false, isAssisted: false },
    { name: 'Machine Reverse Fly', primaryMuscle: 'REAR_DELT', secondaryMuscles: ['RHOMBOIDS', 'TRAPS_MID'], equipment: 'MACHINE_SELECTORIZED', movementPattern: 'ISOLATION', isUnilateral: false, isBodyweight: false, isAssisted: false },
    { name: 'Face Pull', primaryMuscle: 'REAR_DELT', secondaryMuscles: ['TRAPS_MID', 'RHOMBOIDS', 'SIDE_DELT'], equipment: 'CABLE', movementPattern: 'HORIZONTAL_PULL', isUnilateral: false, isBodyweight: false, isAssisted: false },
    { name: 'Low-to-High Cable Fly', primaryMuscle: 'CHEST_UPPER', secondaryMuscles: ['FRONT_DELT', 'BICEPS_SHORT_HEAD'], equipment: 'CABLE', movementPattern: 'ISOLATION', isUnilateral: false, isBodyweight: false, isAssisted: false },
    { name: 'Cable Crunch', primaryMuscle: 'ABS', secondaryMuscles: ['OBLIQUES'], equipment: 'CABLE', movementPattern: 'ISOLATION', isUnilateral: false, isBodyweight: false, isAssisted: false },
    { name: 'Ab Wheel Rollout', primaryMuscle: 'ABS', secondaryMuscles: ['OBLIQUES', 'LOWER_BACK', 'FRONT_DELT'], equipment: 'BODYWEIGHT', movementPattern: 'ISOLATION', isUnilateral: false, isBodyweight: true, isAssisted: false },
  ];

  for (const ex of newExercises) {
    await prisma.exercise.upsert({
      where: { name: ex.name },
      update: {},
      create: ex as any,
    });
    console.log('upserted:', ex.name);
  }

  console.log('Patch v2 complete.', newExercises.length, 'exercises.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
