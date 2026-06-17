import * as dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({
  connectionString: process.env.POSTGRES_PRISMA_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────────────────────
// HYPERTROPHY EXERCISE LIBRARY — ANATOMY ENGINE
//
// Every exercise tagged based on peer-reviewed EMG literature:
//
// Biceps: Myomax EMG (2025), ACE (2014), Oliveira et al. (2009)
// Triceps: Boehren's & Buskies (2000), ACE (2012), Kim et al. (2011)
// Quads: Strengthlog squat vs extension (2025), ResearchGate squat EMG (2020)
// Hamstrings: McAllister et al. (2014), Zebis et al. (2013), PLOS ONE (2020)
// Calves: Kinoshita et al. (2025), Schoenfeld & Contreras
// Back: Lehman et al. (2004), NCBI PMC12452428 (2025)
// ─────────────────────────────────────────────────────────────────────────────

const exercises = [

  // ═══════════════════════════════════════════════════════════════════════════
  // QUADS
  //
  // Squats primarily develop vastus lateralis (mid-to-knee) and vastus medialis
  // but do NOT meaningfully grow rectus femoris.
  // Leg extensions are the only effective rectus femoris developer.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Barbell Back Squat',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'GLUTE_MAX', 'HAMSTRING_MEDIAL', 'LOWER_BACK'],
    equipment: 'BARBELL',
    movementPattern: 'SQUAT',
  },
  {
    name: 'Barbell Front Squat',
    // Front squat: highest overall quad EMG per ResearchGate 2020
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'QUAD_RECTUS_FEMORIS', 'GLUTE_MAX', 'ABS', 'TRAPS_UPPER'],
    equipment: 'BARBELL',
    movementPattern: 'SQUAT',
  },
  {
    name: 'Goblet Squat (Dumbbell)',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'GLUTE_MAX', 'ABS'],
    equipment: 'DUMBBELL',
    movementPattern: 'SQUAT',
    weightIsPerSide: false,
  },
  {
    name: 'Goblet Squat (Kettlebell)',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'GLUTE_MAX', 'ABS'],
    equipment: 'KETTLEBELL',
    movementPattern: 'SQUAT',
    weightIsPerSide: false,
  },
  {
    name: 'Hack Squat Machine',
    // Best VMO (teardrop) developer per SuppVersity EMG
    primaryMuscle: 'QUAD_VASTUS_MEDIALIS',
    secondaryMuscles: ['QUAD_VASTUS_LATERALIS', 'GLUTE_MAX'],
    equipment: 'MACHINE_PLATE_LOADED',
    movementPattern: 'SQUAT',
    weightIsPerSide: false,
  },
  {
    name: 'FreeMotion Squat',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'GLUTE_MAX'],
    equipment: 'FREEMOTION',
    movementPattern: 'SQUAT',
    weightIsPerSide: false,
  },
  {
    name: 'Smith Machine Squat',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'GLUTE_MAX'],
    equipment: 'SMITH_MACHINE',
    movementPattern: 'SQUAT',
    weightIsPerSide: false,
  },
  {
    name: 'Leg Press',
    // VL and VM highest, RF moderate per systematic review
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'QUAD_RECTUS_FEMORIS', 'GLUTE_MAX'],
    equipment: 'MACHINE_PLATE_LOADED',
    movementPattern: 'SQUAT',
  },
  {
    name: 'Leg Extension',
    // THE rectus femoris builder. Also grows VL near hip (opposite to squats)
    primaryMuscle: 'QUAD_RECTUS_FEMORIS',
    secondaryMuscles: ['QUAD_VASTUS_LATERALIS', 'QUAD_VASTUS_MEDIALIS'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Bulgarian Split Squat (Dumbbell)',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'GLUTE_MAX', 'HAMSTRING_MEDIAL'],
    equipment: 'DUMBBELL',
    movementPattern: 'LUNGE',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Bulgarian Split Squat (Barbell)',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'GLUTE_MAX', 'HAMSTRING_MEDIAL'],
    equipment: 'BARBELL',
    movementPattern: 'LUNGE',
    isUnilateral: true,
  },
  {
    name: 'Bulgarian Split Squat Machine',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'GLUTE_MAX', 'HAMSTRING_MEDIAL'],
    equipment: 'MACHINE_PLATE_LOADED',
    movementPattern: 'LUNGE',
    isUnilateral: true,
  },
  {
    name: 'Assisted Bulgarian Split Squat',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['QUAD_VASTUS_MEDIALIS', 'GLUTE_MAX', 'HAMSTRING_MEDIAL'],
    equipment: 'ASSISTED_BODYWEIGHT',
    movementPattern: 'LUNGE',
    isUnilateral: true,
  },
  {
    name: 'Walking Lunge (Dumbbell)',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['GLUTE_MAX', 'QUAD_VASTUS_MEDIALIS', 'HAMSTRING_MEDIAL'],
    equipment: 'DUMBBELL',
    movementPattern: 'LUNGE',
    weightIsPerSide: true,
  },
  {
    name: 'Reverse Lunge (Dumbbell)',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['GLUTE_MAX', 'QUAD_VASTUS_MEDIALIS', 'HAMSTRING_MEDIAL'],
    equipment: 'DUMBBELL',
    movementPattern: 'LUNGE',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Step-Up (Dumbbell)',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['GLUTE_MAX', 'QUAD_VASTUS_MEDIALIS'],
    equipment: 'DUMBBELL',
    movementPattern: 'LUNGE',
    isUnilateral: true,
    weightIsPerSide: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HAMSTRINGS
  //
  // RDLs preferentially target semitendinosus/semimembranosus (medial).
  // Prone/supine leg curls preferentially target biceps femoris (lateral).
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Romanian Deadlift (Barbell)',
    primaryMuscle: 'HAMSTRING_MEDIAL',
    secondaryMuscles: ['HAMSTRING_BICEPS_FEMORIS', 'GLUTE_MAX', 'LOWER_BACK'],
    equipment: 'BARBELL',
    movementPattern: 'HINGE',
  },
  {
    name: 'Romanian Deadlift (Dumbbell)',
    primaryMuscle: 'HAMSTRING_MEDIAL',
    secondaryMuscles: ['HAMSTRING_BICEPS_FEMORIS', 'GLUTE_MAX', 'LOWER_BACK'],
    equipment: 'DUMBBELL',
    movementPattern: 'HINGE',
    weightIsPerSide: true,
  },
  {
    name: 'Stiff-Leg Deadlift',
    primaryMuscle: 'HAMSTRING_MEDIAL',
    secondaryMuscles: ['HAMSTRING_BICEPS_FEMORIS', 'GLUTE_MAX', 'LOWER_BACK'],
    equipment: 'BARBELL',
    movementPattern: 'HINGE',
  },
  {
    name: 'Nordic Hamstring Curl',
    primaryMuscle: 'HAMSTRING_BICEPS_FEMORIS',
    secondaryMuscles: ['HAMSTRING_MEDIAL', 'GLUTE_MAX'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'HINGE',
  },
  {
    name: 'Prone Leg Curl Machine',
    // Higher BF activation than RDL per Schoenfeld 2015
    primaryMuscle: 'HAMSTRING_BICEPS_FEMORIS',
    secondaryMuscles: ['HAMSTRING_MEDIAL', 'GASTROCNEMIUS'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Seated Leg Curl Machine',
    // Best overall motor unit recruitment per Ebben 2006
    primaryMuscle: 'HAMSTRING_BICEPS_FEMORIS',
    secondaryMuscles: ['HAMSTRING_MEDIAL', 'GASTROCNEMIUS'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Standing Single-Leg Curl Machine',
    primaryMuscle: 'HAMSTRING_BICEPS_FEMORIS',
    secondaryMuscles: ['GLUTE_MAX'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
  },
  {
    name: 'Cable Pull-Through',
    primaryMuscle: 'HAMSTRING_MEDIAL',
    secondaryMuscles: ['GLUTE_MAX', 'LOWER_BACK'],
    equipment: 'CABLE',
    movementPattern: 'HINGE',
  },
  {
    name: 'Good Morning',
    primaryMuscle: 'HAMSTRING_MEDIAL',
    secondaryMuscles: ['LOWER_BACK', 'GLUTE_MAX'],
    equipment: 'BARBELL',
    movementPattern: 'HINGE',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GLUTES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Barbell Hip Thrust',
    primaryMuscle: 'GLUTE_MAX',
    secondaryMuscles: ['HAMSTRING_MEDIAL', 'QUAD_VASTUS_LATERALIS'],
    equipment: 'BARBELL',
    movementPattern: 'HINGE',
  },
  {
    name: 'Hip Thrust Machine',
    primaryMuscle: 'GLUTE_MAX',
    secondaryMuscles: ['HAMSTRING_MEDIAL'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'HINGE',
  },
  {
    name: 'Cable Kickback',
    primaryMuscle: 'GLUTE_MAX',
    secondaryMuscles: ['HAMSTRING_MEDIAL'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Glute Bridge (Bodyweight)',
    primaryMuscle: 'GLUTE_MAX',
    secondaryMuscles: ['HAMSTRING_MEDIAL'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'HINGE',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CALVES
  //
  // Standing = 2x more total calf hypertrophy than seated.
  // Seated = soleus emphasis due to bent-knee gastrocnemius disadvantage.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Standing Calf Raise Machine',
    primaryMuscle: 'GASTROCNEMIUS',
    secondaryMuscles: ['SOLEUS'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Seated Calf Raise Machine',
    primaryMuscle: 'SOLEUS',
    secondaryMuscles: ['GASTROCNEMIUS'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Leg Press Calf Raise',
    primaryMuscle: 'GASTROCNEMIUS',
    secondaryMuscles: ['SOLEUS'],
    equipment: 'MACHINE_PLATE_LOADED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Standing Calf Raise (Dumbbell)',
    primaryMuscle: 'GASTROCNEMIUS',
    secondaryMuscles: ['SOLEUS'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HIP ABDUCTOR / ADDUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Hip Abductor Machine',
    primaryMuscle: 'HIP_ABDUCTOR',
    secondaryMuscles: ['GLUTE_MED'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Hip Adductor Machine',
    primaryMuscle: 'HIP_ADDUCTOR',
    secondaryMuscles: [],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Cable Hip Abduction',
    primaryMuscle: 'HIP_ABDUCTOR',
    secondaryMuscles: ['GLUTE_MED'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Cable Hip Adduction',
    primaryMuscle: 'HIP_ADDUCTOR',
    secondaryMuscles: [],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHEST
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Barbell Bench Press',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['FRONT_DELT', 'TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'BARBELL',
    movementPattern: 'HORIZONTAL_PUSH',
  },
  {
    name: 'Incline Barbell Bench Press',
    primaryMuscle: 'CHEST_UPPER',
    secondaryMuscles: ['FRONT_DELT', 'TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'BARBELL',
    movementPattern: 'HORIZONTAL_PUSH',
  },
  {
    name: 'Decline Barbell Bench Press',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD', 'FRONT_DELT'],
    equipment: 'BARBELL',
    movementPattern: 'HORIZONTAL_PUSH',
  },
  {
    name: 'Dumbbell Bench Press',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['FRONT_DELT', 'TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'DUMBBELL',
    movementPattern: 'HORIZONTAL_PUSH',
    weightIsPerSide: true,
  },
  {
    name: 'Incline Dumbbell Bench Press',
    primaryMuscle: 'CHEST_UPPER',
    secondaryMuscles: ['FRONT_DELT', 'TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'DUMBBELL',
    movementPattern: 'HORIZONTAL_PUSH',
    weightIsPerSide: true,
  },
  {
    name: 'Decline Dumbbell Bench Press',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD', 'FRONT_DELT'],
    equipment: 'DUMBBELL',
    movementPattern: 'HORIZONTAL_PUSH',
    weightIsPerSide: true,
  },
  {
    name: 'Smith Machine Bench Press',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['FRONT_DELT', 'TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'SMITH_MACHINE',
    movementPattern: 'HORIZONTAL_PUSH',
  },
  {
    name: 'Incline Smith Machine Bench Press',
    primaryMuscle: 'CHEST_UPPER',
    secondaryMuscles: ['FRONT_DELT', 'TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'SMITH_MACHINE',
    movementPattern: 'HORIZONTAL_PUSH',
  },
  {
    name: 'Chest Press Machine (Selectorized)',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['FRONT_DELT', 'TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'HORIZONTAL_PUSH',
  },
  {
    name: 'Incline Chest Press Machine',
    primaryMuscle: 'CHEST_UPPER',
    secondaryMuscles: ['FRONT_DELT', 'TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'HORIZONTAL_PUSH',
  },
  {
    // Plate-loaded, iso-lateral (independent arms — like pressing two dumbbells).
    // Log the weight per arm; weightIsPerSide doubles it for e1RM/progression.
    name: 'Hammer Strength Chest Press',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['FRONT_DELT', 'TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'MACHINE_PLATE_LOADED',
    movementPattern: 'HORIZONTAL_PUSH',
    weightIsPerSide: true,
  },
  {
    name: 'FreeMotion Dual Cross Chest Fly (Low to High)',
    primaryMuscle: 'CHEST_UPPER',
    secondaryMuscles: ['FRONT_DELT'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'FreeMotion Dual Cross Chest Fly (High to Low)',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['FRONT_DELT'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'FreeMotion Dual Cross Chest Fly (Neutral)',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['CHEST_UPPER', 'FRONT_DELT'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'Cable Pec Deck',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['CHEST_UPPER', 'FRONT_DELT'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    weightIsPerSide: false,
  },
  {
    name: 'Pec Deck Machine',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['CHEST_UPPER'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Dumbbell Chest Fly',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['FRONT_DELT'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'Push-Up',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['FRONT_DELT', 'TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'HORIZONTAL_PUSH',
  },
  {
    name: 'Dip (Chest Variation)',
    primaryMuscle: 'CHEST_MID_LOWER',
    secondaryMuscles: ['TRICEPS_LONG_HEAD', 'TRICEPS_LATERAL_HEAD', 'FRONT_DELT'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'HORIZONTAL_PUSH',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SHOULDERS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Barbell Overhead Press',
    primaryMuscle: 'FRONT_DELT',
    secondaryMuscles: ['SIDE_DELT', 'TRICEPS_LONG_HEAD', 'TRICEPS_LATERAL_HEAD', 'TRAPS_UPPER'],
    equipment: 'BARBELL',
    movementPattern: 'VERTICAL_PUSH',
  },
  {
    name: 'Seated Dumbbell Shoulder Press',
    primaryMuscle: 'FRONT_DELT',
    secondaryMuscles: ['SIDE_DELT', 'TRICEPS_LONG_HEAD', 'TRICEPS_LATERAL_HEAD'],
    equipment: 'DUMBBELL',
    movementPattern: 'VERTICAL_PUSH',
    weightIsPerSide: true,
  },
  {
    name: 'Standing Dumbbell Shoulder Press',
    primaryMuscle: 'FRONT_DELT',
    secondaryMuscles: ['SIDE_DELT', 'TRICEPS_LONG_HEAD', 'TRICEPS_LATERAL_HEAD', 'ABS'],
    equipment: 'DUMBBELL',
    movementPattern: 'VERTICAL_PUSH',
    weightIsPerSide: true,
  },
  {
    name: 'Smith Machine Overhead Press',
    primaryMuscle: 'FRONT_DELT',
    secondaryMuscles: ['SIDE_DELT', 'TRICEPS_LONG_HEAD', 'TRICEPS_LATERAL_HEAD'],
    equipment: 'SMITH_MACHINE',
    movementPattern: 'VERTICAL_PUSH',
  },
  {
    name: 'Machine Shoulder Press',
    primaryMuscle: 'FRONT_DELT',
    secondaryMuscles: ['SIDE_DELT', 'TRICEPS_LONG_HEAD', 'TRICEPS_LATERAL_HEAD'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'VERTICAL_PUSH',
  },
  {
    name: 'Hammer Strength Shoulder Press',
    primaryMuscle: 'FRONT_DELT',
    secondaryMuscles: ['SIDE_DELT', 'TRICEPS_LONG_HEAD', 'TRICEPS_LATERAL_HEAD'],
    equipment: 'MACHINE_PLATE_LOADED',
    movementPattern: 'VERTICAL_PUSH',
  },
  {
    name: 'Seated Cable Shoulder Press',
    primaryMuscle: 'FRONT_DELT',
    secondaryMuscles: ['SIDE_DELT', 'TRICEPS_LONG_HEAD', 'TRICEPS_LATERAL_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'VERTICAL_PUSH',
  },
  {
    name: 'Dumbbell Lateral Raise',
    primaryMuscle: 'SIDE_DELT',
    secondaryMuscles: ['TRAPS_UPPER'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'Dumbbell Lateral Raise (Single Arm)',
    primaryMuscle: 'SIDE_DELT',
    secondaryMuscles: ['TRAPS_UPPER'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Cable Lateral Raise',
    primaryMuscle: 'SIDE_DELT',
    secondaryMuscles: ['TRAPS_UPPER'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Side Delt Cable Lateral Raise',
    primaryMuscle: 'SIDE_DELT',
    secondaryMuscles: [],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Machine Lateral Raise',
    primaryMuscle: 'SIDE_DELT',
    secondaryMuscles: [],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Anterior Delt Raise (Dumbbell)',
    primaryMuscle: 'FRONT_DELT',
    secondaryMuscles: ['CHEST_UPPER'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'Anterior Delt Raise (Cable Bar)',
    primaryMuscle: 'FRONT_DELT',
    secondaryMuscles: ['CHEST_UPPER'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Anterior Delt Raise (Cable Single Handle)',
    primaryMuscle: 'FRONT_DELT',
    secondaryMuscles: ['CHEST_UPPER'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Cable Rear Delt Fly',
    primaryMuscle: 'REAR_DELT',
    secondaryMuscles: ['TRAPS_MID', 'RHOMBOIDS'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Cable Rear Delt Pull',
    primaryMuscle: 'REAR_DELT',
    secondaryMuscles: ['TRAPS_MID'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Dumbbell Rear Delt Fly',
    primaryMuscle: 'REAR_DELT',
    secondaryMuscles: ['TRAPS_MID', 'RHOMBOIDS'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'Dumbbell Rear Delt Fly (Single Arm)',
    primaryMuscle: 'REAR_DELT',
    secondaryMuscles: ['TRAPS_MID', 'RHOMBOIDS'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Reverse Pec Deck',
    primaryMuscle: 'REAR_DELT',
    secondaryMuscles: ['TRAPS_MID', 'RHOMBOIDS'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Face Pull',
    primaryMuscle: 'REAR_DELT',
    secondaryMuscles: ['TRAPS_MID', 'RHOMBOIDS', 'BICEPS_SHORT_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'HORIZONTAL_PULL',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BACK / LATS
  //
  // Grip width does NOT significantly alter lat activation.
  // Rows activate traps/rhomboids more than pulldowns.
  // Seated row = highest mid-trap activation.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Pull-Up',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['BICEPS_SHORT_HEAD', 'BICEPS_LONG_HEAD', 'TRAPS_LOWER', 'TERES_MAJOR', 'REAR_DELT'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'VERTICAL_PULL',
  },
  {
    name: 'Assisted Pull-Up Machine',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['BICEPS_SHORT_HEAD', 'BICEPS_LONG_HEAD', 'TRAPS_LOWER'],
    equipment: 'ASSISTED_BODYWEIGHT',
    movementPattern: 'VERTICAL_PULL',
  },
  {
    name: 'Negative Pull-Up',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['BICEPS_SHORT_HEAD', 'BICEPS_LONG_HEAD', 'TRAPS_LOWER', 'TERES_MAJOR', 'REAR_DELT'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'VERTICAL_PULL',
  },
  {
    name: 'Negative Pull-Up (Assisted)',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['BICEPS_SHORT_HEAD', 'BICEPS_LONG_HEAD', 'TRAPS_LOWER'],
    equipment: 'ASSISTED_BODYWEIGHT',
    movementPattern: 'VERTICAL_PULL',
  },
  {
    name: 'Chin-Up',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['BICEPS_SHORT_HEAD', 'BICEPS_LONG_HEAD', 'TRAPS_LOWER', 'TERES_MAJOR'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'VERTICAL_PULL',
  },
  {
    name: 'Lat Pulldown (Wide Grip)',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['TERES_MAJOR', 'BICEPS_SHORT_HEAD', 'TRAPS_LOWER', 'REAR_DELT', 'RHOMBOIDS'],
    equipment: 'CABLE',
    movementPattern: 'VERTICAL_PULL',
  },
  {
    name: 'Lat Pulldown (Close Grip)',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['BICEPS_SHORT_HEAD', 'BICEPS_LONG_HEAD', 'TRAPS_LOWER'],
    equipment: 'CABLE',
    movementPattern: 'VERTICAL_PULL',
  },
  {
    name: 'Machine Lat Pulldown',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['BICEPS_SHORT_HEAD', 'TRAPS_LOWER'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'VERTICAL_PULL',
  },
  {
    name: 'Single-Arm Cable Pulldown',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['BICEPS_LONG_HEAD', 'TERES_MAJOR'],
    equipment: 'CABLE',
    movementPattern: 'VERTICAL_PULL',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Kneeling Single-Arm Lat Pulldown',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['BICEPS_LONG_HEAD', 'TERES_MAJOR', 'REAR_DELT'],
    equipment: 'CABLE',
    movementPattern: 'VERTICAL_PULL',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Standing Cable Pulldown (Straight-Arm)',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['TRICEPS_LONG_HEAD', 'TERES_MAJOR'],
    equipment: 'CABLE',
    movementPattern: 'VERTICAL_PULL',
  },
  {
    name: 'Barbell Bent-Over Row',
    primaryMuscle: 'TRAPS_MID',
    secondaryMuscles: ['LATS', 'RHOMBOIDS', 'BICEPS_SHORT_HEAD', 'REAR_DELT', 'LOWER_BACK'],
    equipment: 'BARBELL',
    movementPattern: 'HORIZONTAL_PULL',
  },
  {
    name: 'Dumbbell Single-Arm Row',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['TRAPS_MID', 'RHOMBOIDS', 'BICEPS_SHORT_HEAD', 'REAR_DELT'],
    equipment: 'DUMBBELL',
    movementPattern: 'HORIZONTAL_PULL',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Croc Row',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['TRAPS_MID', 'RHOMBOIDS', 'BICEPS_SHORT_HEAD', 'REAR_DELT'],
    equipment: 'DUMBBELL',
    movementPattern: 'HORIZONTAL_PULL',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Seated Cable Row (Wide Grip)',
    primaryMuscle: 'TRAPS_MID',
    secondaryMuscles: ['LATS', 'RHOMBOIDS', 'REAR_DELT', 'BICEPS_SHORT_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'HORIZONTAL_PULL',
  },
  {
    name: 'Seated Cable Row (Close Grip)',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['TRAPS_MID', 'RHOMBOIDS', 'BICEPS_SHORT_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'HORIZONTAL_PULL',
  },
  {
    name: 'Machine Chest-Supported Row',
    primaryMuscle: 'TRAPS_MID',
    secondaryMuscles: ['LATS', 'RHOMBOIDS', 'BICEPS_SHORT_HEAD', 'REAR_DELT'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'HORIZONTAL_PULL',
  },
  {
    name: 'T-Bar Row',
    primaryMuscle: 'TRAPS_MID',
    secondaryMuscles: ['LATS', 'RHOMBOIDS', 'BICEPS_SHORT_HEAD', 'LOWER_BACK'],
    equipment: 'BARBELL',
    movementPattern: 'HORIZONTAL_PULL',
  },
  {
    name: 'Chest-Supported T-Bar Row',
    primaryMuscle: 'TRAPS_MID',
    secondaryMuscles: ['LATS', 'RHOMBOIDS', 'BICEPS_SHORT_HEAD', 'REAR_DELT'],
    equipment: 'MACHINE_PLATE_LOADED',
    movementPattern: 'HORIZONTAL_PULL',
  },
  {
    name: 'Horizontal Row Machine (Selectorized)',
    primaryMuscle: 'TRAPS_MID',
    secondaryMuscles: ['LATS', 'RHOMBOIDS', 'BICEPS_SHORT_HEAD', 'REAR_DELT'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'HORIZONTAL_PULL',
  },
  {
    name: 'Smith Machine Bent-Over Row',
    primaryMuscle: 'TRAPS_MID',
    secondaryMuscles: ['LATS', 'RHOMBOIDS', 'BICEPS_SHORT_HEAD'],
    equipment: 'SMITH_MACHINE',
    movementPattern: 'HORIZONTAL_PULL',
  },
  {
    name: 'Straight-Arm Cable Pulldown',
    primaryMuscle: 'LATS',
    secondaryMuscles: ['TERES_MAJOR', 'TRICEPS_LONG_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Deadlift',
    primaryMuscle: 'LOWER_BACK',
    secondaryMuscles: ['HAMSTRING_MEDIAL', 'HAMSTRING_BICEPS_FEMORIS', 'GLUTE_MAX', 'TRAPS_UPPER', 'QUAD_VASTUS_LATERALIS'],
    equipment: 'BARBELL',
    movementPattern: 'HINGE',
  },
  {
    name: 'Sumo Deadlift',
    primaryMuscle: 'GLUTE_MAX',
    secondaryMuscles: ['HAMSTRING_MEDIAL', 'QUAD_VASTUS_LATERALIS', 'LOWER_BACK', 'HIP_ADDUCTOR'],
    equipment: 'BARBELL',
    movementPattern: 'HINGE',
  },
  {
    name: 'Trap Bar Deadlift',
    primaryMuscle: 'QUAD_VASTUS_LATERALIS',
    secondaryMuscles: ['GLUTE_MAX', 'HAMSTRING_MEDIAL', 'LOWER_BACK', 'TRAPS_UPPER'],
    equipment: 'BARBELL',
    movementPattern: 'HINGE',
  },
  {
    name: 'Shrug (Barbell)',
    primaryMuscle: 'TRAPS_UPPER',
    secondaryMuscles: ['FOREARMS'],
    equipment: 'BARBELL',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Shrug (Dumbbell)',
    primaryMuscle: 'TRAPS_UPPER',
    secondaryMuscles: ['FOREARMS'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BICEPS
  //
  // Hammer curls = significantly less biceps activation; primarily brachialis
  // Incline/Bayesian = long head (shoulder extended)
  // Preacher/spider = short head (shoulder flexed)
  // Wide grip = short head; narrow grip = long head
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Barbell Curl',
    primaryMuscle: 'BICEPS_SHORT_HEAD',
    secondaryMuscles: ['BICEPS_LONG_HEAD', 'BRACHIALIS', 'BRACHIORADIALIS'],
    equipment: 'BARBELL',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'EZ-Bar Curl (Wide Grip)',
    primaryMuscle: 'BICEPS_SHORT_HEAD',
    secondaryMuscles: ['BICEPS_LONG_HEAD', 'BRACHIALIS', 'BRACHIORADIALIS'],
    equipment: 'BARBELL',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'EZ-Bar Curl (Narrow Grip)',
    primaryMuscle: 'BICEPS_LONG_HEAD',
    secondaryMuscles: ['BICEPS_SHORT_HEAD', 'BRACHIALIS', 'BRACHIORADIALIS'],
    equipment: 'BARBELL',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Dumbbell Curl (Standing)',
    primaryMuscle: 'BICEPS_SHORT_HEAD',
    secondaryMuscles: ['BICEPS_LONG_HEAD', 'BRACHIALIS'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'Incline Dumbbell Curl',
    // Shoulder extended = maximum long head stretch
    primaryMuscle: 'BICEPS_LONG_HEAD',
    secondaryMuscles: ['BICEPS_SHORT_HEAD'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'Bayesian Cable Curl',
    // Cable behind body = shoulder hyperextended = long head stretch
    primaryMuscle: 'BICEPS_LONG_HEAD',
    secondaryMuscles: ['BICEPS_SHORT_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Hammer Curl',
    // EMG: significantly less biceps activation — primarily brachialis
    primaryMuscle: 'BRACHIALIS',
    secondaryMuscles: ['BRACHIORADIALIS', 'BICEPS_LONG_HEAD'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'Cross-Body Hammer Curl',
    primaryMuscle: 'BRACHIALIS',
    secondaryMuscles: ['BRACHIORADIALIS', 'BICEPS_SHORT_HEAD'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Cable Curl',
    primaryMuscle: 'BICEPS_SHORT_HEAD',
    secondaryMuscles: ['BICEPS_LONG_HEAD', 'BRACHIALIS'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Cable Hammer Curl',
    primaryMuscle: 'BRACHIALIS',
    secondaryMuscles: ['BRACHIORADIALIS', 'BICEPS_LONG_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Cable Bicep Curl (Bar)',
    primaryMuscle: 'BICEPS_SHORT_HEAD',
    secondaryMuscles: ['BICEPS_LONG_HEAD', 'BRACHIALIS'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Cable Bicep Curl (Single Arm)',
    primaryMuscle: 'BICEPS_SHORT_HEAD',
    secondaryMuscles: ['BICEPS_LONG_HEAD', 'BRACHIALIS'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Machine Preacher Curl',
    // Shoulder flexed = short head bias
    primaryMuscle: 'BICEPS_SHORT_HEAD',
    secondaryMuscles: ['BRACHIALIS'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Spider Curl',
    primaryMuscle: 'BICEPS_SHORT_HEAD',
    secondaryMuscles: ['BRACHIALIS'],
    equipment: 'BARBELL',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Concentration Curl',
    primaryMuscle: 'BICEPS_SHORT_HEAD',
    secondaryMuscles: ['BRACHIALIS'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Seated Dumbbell Isolation Curl',
    primaryMuscle: 'BICEPS_SHORT_HEAD',
    secondaryMuscles: ['BRACHIALIS'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRICEPS
  //
  // Overhead = long head (crosses shoulder, stretched)
  // Pushdowns bar = lateral head isolation
  // Medial head recruited first in all movements
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Close-Grip Bench Press',
    primaryMuscle: 'TRICEPS_LATERAL_HEAD',
    secondaryMuscles: ['TRICEPS_LONG_HEAD', 'TRICEPS_MEDIAL_HEAD', 'CHEST_MID_LOWER', 'FRONT_DELT'],
    equipment: 'BARBELL',
    movementPattern: 'HORIZONTAL_PUSH',
  },
  {
    name: 'Skull Crusher (EZ-Bar)',
    primaryMuscle: 'TRICEPS_LONG_HEAD',
    secondaryMuscles: ['TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'BARBELL',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Skull Crusher (Dumbbell)',
    primaryMuscle: 'TRICEPS_LONG_HEAD',
    secondaryMuscles: ['TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: true,
  },
  {
    name: 'Overhead Triceps Extension (Cable)',
    primaryMuscle: 'TRICEPS_LONG_HEAD',
    secondaryMuscles: ['TRICEPS_MEDIAL_HEAD', 'TRICEPS_LATERAL_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Overhead Triceps Extension (Dumbbell)',
    primaryMuscle: 'TRICEPS_LONG_HEAD',
    secondaryMuscles: ['TRICEPS_MEDIAL_HEAD', 'TRICEPS_LATERAL_HEAD'],
    equipment: 'DUMBBELL',
    movementPattern: 'ISOLATION',
    weightIsPerSide: false,
  },
  {
    name: 'Triceps Pushdown (Rope)',
    primaryMuscle: 'TRICEPS_LATERAL_HEAD',
    secondaryMuscles: ['TRICEPS_MEDIAL_HEAD', 'TRICEPS_LONG_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Triceps Pushdown (Bar)',
    // Best lateral head isolation per EMG
    primaryMuscle: 'TRICEPS_LATERAL_HEAD',
    secondaryMuscles: ['TRICEPS_MEDIAL_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Cable Triceps Extension (Single Arm)',
    primaryMuscle: 'TRICEPS_LATERAL_HEAD',
    secondaryMuscles: ['TRICEPS_MEDIAL_HEAD', 'TRICEPS_LONG_HEAD'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
    isUnilateral: true,
    weightIsPerSide: true,
  },
  {
    name: 'Machine Triceps Dip',
    primaryMuscle: 'TRICEPS_LATERAL_HEAD',
    secondaryMuscles: ['TRICEPS_LONG_HEAD', 'TRICEPS_MEDIAL_HEAD', 'CHEST_MID_LOWER'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Dip (Triceps Variation)',
    primaryMuscle: 'TRICEPS_LONG_HEAD',
    secondaryMuscles: ['TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD', 'CHEST_MID_LOWER', 'FRONT_DELT'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'VERTICAL_PUSH',
  },
  {
    name: 'Assisted Triceps Dip Machine',
    primaryMuscle: 'TRICEPS_LONG_HEAD',
    secondaryMuscles: ['TRICEPS_LATERAL_HEAD', 'TRICEPS_MEDIAL_HEAD', 'CHEST_MID_LOWER', 'FRONT_DELT'],
    equipment: 'ASSISTED_BODYWEIGHT',
    movementPattern: 'VERTICAL_PUSH',
  },
  {
    name: 'Machine Triceps Extension',
    primaryMuscle: 'TRICEPS_LONG_HEAD',
    secondaryMuscles: ['TRICEPS_MEDIAL_HEAD', 'TRICEPS_LATERAL_HEAD'],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ABS / CORE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    name: 'Cable Crunch',
    primaryMuscle: 'ABS',
    secondaryMuscles: ['OBLIQUES'],
    equipment: 'CABLE',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Machine Crunch',
    primaryMuscle: 'ABS',
    secondaryMuscles: [],
    equipment: 'MACHINE_SELECTORIZED',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Hanging Leg Raise',
    primaryMuscle: 'ABS',
    secondaryMuscles: ['OBLIQUES', 'QUAD_RECTUS_FEMORIS'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Ab Wheel Rollout',
    primaryMuscle: 'ABS',
    secondaryMuscles: ['LOWER_BACK', 'LATS'],
    equipment: 'OTHER',
    movementPattern: 'ISOLATION',
  },
  {
    name: 'Plank',
    primaryMuscle: 'ABS',
    secondaryMuscles: ['LOWER_BACK', 'OBLIQUES'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'CARRY',
    isTimeBased: true,
  },
  {
    name: 'Farmer Carry',
    primaryMuscle: 'TRAPS_UPPER',
    secondaryMuscles: ['FOREARMS', 'ABS', 'LOWER_BACK', 'OBLIQUES'],
    equipment: 'DUMBBELL',
    movementPattern: 'CARRY',
    isTimeBased: true,
    weightIsPerSide: true,
  },
  {
    name: 'Farmer Carry (Single Arm)',
    primaryMuscle: 'TRAPS_UPPER',
    secondaryMuscles: ['FOREARMS', 'OBLIQUES', 'ABS', 'LOWER_BACK'],
    equipment: 'DUMBBELL',
    movementPattern: 'CARRY',
    isUnilateral: true,
    isTimeBased: true,
    weightIsPerSide: true,
  },
  {
    name: 'Dead Hang',
    primaryMuscle: 'FOREARMS',
    secondaryMuscles: ['LATS', 'TRAPS_LOWER'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'CARRY',
    isTimeBased: true,
  },
  {
    name: 'Wall Sit',
    primaryMuscle: 'QUAD_RECTUS_FEMORIS',
    secondaryMuscles: ['QUAD_VASTUS_LATERALIS', 'QUAD_VASTUS_MEDIALIS', 'GLUTE_MAX'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'CARRY',
    isTimeBased: true,
  },
  {
    name: 'Russian Twist',
    primaryMuscle: 'OBLIQUES',
    secondaryMuscles: ['ABS'],
    equipment: 'BODYWEIGHT',
    movementPattern: 'ISOLATION',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seeding ${exercises.length} exercises with granular anatomy tagging...`);

  let created = 0;
  let skipped = 0;

  for (const ex of exercises) {
    try {
await (prisma.exercise.upsert as any)({
  where: { name: ex.name },
update: {
    primaryMuscle: ex.primaryMuscle,
    secondaryMuscles: ex.secondaryMuscles,
    equipment: ex.equipment,
    movementPattern: ex.movementPattern,
    isUnilateral: (ex as any).isUnilateral ?? false,
    weightIsPerSide: (ex as any).weightIsPerSide ?? false,
    isTimeBased: (ex as any).isTimeBased ?? false,
    isBodyweight: (ex as any).isBodyweight ?? false,
    isAssisted: (ex as any).isAssisted ?? false,
  },
  create: {
    name: ex.name,
    primaryMuscle: ex.primaryMuscle,
    secondaryMuscles: ex.secondaryMuscles,
    equipment: ex.equipment,
    movementPattern: ex.movementPattern,
    isUnilateral: (ex as any).isUnilateral ?? false,
    weightIsPerSide: (ex as any).weightIsPerSide ?? false,
    isTimeBased: (ex as any).isTimeBased ?? false,
    isBodyweight: (ex as any).isBodyweight ?? false,
    isAssisted: (ex as any).isAssisted ?? false,
  },
});
      created++;
    } catch (e: any) {
      console.error(`Failed on: ${ex.name}`, e.message);
      skipped++;
    }
  }

  console.log(`\nDone. ${created} exercises upserted, ${skipped} failed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });