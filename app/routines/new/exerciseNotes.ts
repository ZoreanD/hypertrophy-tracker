// Exercise science notes — sourced from peer-reviewed EMG literature and RP Strength
// Displayed as tooltips in routine builder and live workout
// Sources: Schoenfeld 2015, Ebben 2006, ResearchGate 2020, SuppVersity EMG series

export const EXERCISE_SCIENCE_NOTES: Record<string, string> = {
  // ── Quads ────────────────────────────────────────────────────────────────
  'Barbell Front Squat':
    'Highest overall quad EMG of all squat variations per ResearchGate 2020. Upright torso maximizes rectus femoris contribution.',
  'Barbell Back Squat':
    'Primarily grows vastus lateralis and vastus medialis. Does NOT meaningfully develop rectus femoris — add leg extensions for full quad development.',
  'Hack Squat Machine':
    'Best VMO (teardrop) developer per SuppVersity EMG. Foot placement low and narrow increases vasti activation.',
  'Leg Press':
    'VL and VM highest, RF moderate. Foot position shifts emphasis — low/narrow = quads, high/wide = glutes and hamstrings.',
  'Leg Extension':
    'Only exercise that effectively develops rectus femoris. Also grows VL near the hip insertion, which squats miss.',
  'Bulgarian Split Squat':
    'Unilateral loading reveals strength asymmetries. Rear foot elevated increases hip flexor stretch and glute activation.',

  // ── Hamstrings ───────────────────────────────────────────────────────────
  'Prone Leg Curl Machine':
    'Higher biceps femoris activation than RDLs per Schoenfeld 2015. Hip-extended position maximally stretches BF.',
  'Seated Leg Curl Machine':
    'Best overall hamstring motor unit recruitment per Ebben 2006. Hip-flexed position fully lengthens all hamstring heads simultaneously.',
  'Standing Single-Leg Curl Machine':
    'Unilateral variation useful for detecting left-right asymmetry. Greater range of motion than prone bilateral version.',
  'Romanian Deadlift':
    'Preferentially targets medial hamstrings (semitendinosus/semimembranosus). Hip hinge with soft knees keeps load on hamstrings not spinal erectors.',
  'Nordic Hamstring Curl':
    'Gold-standard eccentric hamstring exercise. Strongest evidence base for hamstring injury prevention. Very high perceived effort — 2-3 sets sufficient.',
  'Good Morning':
    'Loads hamstrings and erectors simultaneously through hip hinge. Requires careful weight selection — spinal load increases rapidly.',

  // ── Glutes ───────────────────────────────────────────────────────────────
  'Hip Thrust':
    'Greatest glute max activation of any exercise per Contreras 2015. Horizontal load vector keeps tension at full hip extension where squats are unloaded.',
  'Cable Pull-Through':
    'Hip hinge pattern with constant cable tension. Safer for lower back than barbell variations while maintaining glute and medial hamstring stimulus.',
  'Glute Kickback Machine':
    'Isolates glute max with minimal hamstring involvement. Best for direct glute work when compound lifts are fatiguing.',

  // ── Calves ───────────────────────────────────────────────────────────────
  'Standing Calf Raise':
    'Gastrocnemius dominant — knee straight keeps it fully active. ~2× the total hypertrophy stimulus vs seated per Teixeira 2019.',
  'Seated Calf Raise':
    'Bent knee puts gastrocnemius at mechanical disadvantage. Best soleus developer — the soleus responds better to higher rep ranges (15–30).',
  'Donkey Calf Raise':
    'Hip-flexed position pre-stretches gastrocnemius beyond standing position. Some evidence for superior stretch-mediated growth.',

  // ── Chest ────────────────────────────────────────────────────────────────
  'Incline Barbell Bench Press':
    'Upper chest (clavicular head) emphasis. 30–45° is optimal — steeper angles shift load to front delts.',
  'Incline Dumbbell Bench Press':
    'Greater range of motion and stretch than barbell incline. Allows independent arm path for better upper chest stretch at bottom.',
  'Cable Chest Fly (Low to High)':
    'Constant tension through full ROM. Low-to-high cable path maximizes upper chest stretch at the bottom position.',
  'Cable Chest Fly (High to Low)':
    'Best mid/lower chest stretch. Horizontal adduction at full arm extension maximizes pec minor contribution.',
  'Dumbbell Bench Press':
    'Greater ROM and individual arm freedom vs barbell. Allows natural wrist rotation reducing shoulder stress.',

  // ── Shoulders ────────────────────────────────────────────────────────────
  'Dumbbell Lateral Raise':
    'Most effective side delt isolator. Slight forward lean increases side delt EMG. Cable version maintains tension at bottom.',
  'Cable Lateral Raise':
    'Constant tension throughout — unlike dumbbells which have zero tension at the bottom. Better for accumulating volume.',
  'Reverse Pec Deck':
    'High rear delt EMG with minimal trap involvement when performed with proper form (slight forward lean, arms at shoulder height).',
  'Face Pull':
    'Trains rear delts and external rotators simultaneously. Important for shoulder health in heavy pressing programs.',
  'Overhead Press':
    'Front delt dominant compound. Gets significant front delt indirect volume — most lifters do not need direct front delt work.',

  // ── Back ─────────────────────────────────────────────────────────────────
  'Lat Pulldown':
    'Grip width does NOT significantly alter lat activation per meta-analysis. Pulling to the chest > behind the neck for shoulder safety.',
  'Seated Cable Row':
    'Highest mid-trap activation of any row variation. Elbows-in = lat bias, elbows-out = rhomboid/trap bias.',
  'T-Bar Row':
    'Allows heavy loading with neutral grip. Neutral grip reduces biceps fatigue, allowing more back-focused sets.',
  'Chest-Supported Row':
    'Eliminates lower back involvement. Best choice when posterior chain is already fatigued from deadlifts or squats.',
  'Technogym Row Machine (Bilateral)':
    'Plate-loaded row with guided path — highest mid-trap and rhomboid activation of any horizontal pull. Elbows-in = lat bias, elbows-out = rhomboid/trap bias. weightIsPerSide: log per-side plate load.',
  'Technogym Row Machine (Unilateral)':
    'Single-arm plate-loaded row. Independent arms eliminate dominant-side compensation — ideal for correcting L/R strength asymmetry. Same mid-trap/rhomboid primary emphasis as bilateral variation.',
  'Pull-Up':
    'Higher lat activation than pulldowns per multiple EMG studies. Bodyweight makes progressive overload harder — use weight belt.',

  // ── Biceps ───────────────────────────────────────────────────────────────
  'Incline Dumbbell Curl':
    'Shoulder extended position = maximum long head stretch. Best long head hypertrophy per stretch-mediated growth research (Pedrosa 2022).',
  'Bayesian Cable Curl':
    'Cable behind body = shoulder hyperextended = maximum long head stretch throughout ROM. One of the best long head builders.',
  'Hammer Curl':
    'Significantly less biceps activation vs supinated curls per EMG. Primarily develops brachialis and brachioradialis. Include for arm thickness, not peak.',
  'Machine Preacher Curl':
    'Shoulder flexed = maximizes short head (inner bicep peak). Constant tension version better than EZ-bar preacher.',
  'Preacher Curl (Dumbbell, Unilateral)':
    'Preacher bench pins the upper arm, eliminating shoulder flexion cheating — maximizes biceps long head isolation. Full ROM critical: let the elbow extend completely at the bottom for peak stretch-mediated hypertrophy stimulus. Unilateral allows independent loading to correct L/R asymmetry.',
  'EZ-Bar Curl':
    'Semi-supinated grip reduces wrist strain. Slightly less long head activation than fully supinated grip but more comfortable for high volume.',
  'Spider Curl':
    'Horizontal upper arm position = short head bias. Peak contraction emphasis. Pairs well with incline curl for full bicep development.',

  // ── Triceps ──────────────────────────────────────────────────────────────
  'Triceps Pushdown (Bar)':
    'Best lateral head isolation per EMG. Elbow tucked at sides, minimal shoulder movement. Short head dominant.',
  'Cable Overhead Triceps Extension':
    'Long head maximally stretched when arm overhead. Long head makes up ~60% of triceps mass — stretch-mediated growth advantage.',
  'Skull Crusher':
    'High long head activation with elbow flexion overhead at top. Angling the bar slightly back increases stretch.',
  'Close-Grip Bench Press':
    'Compound triceps movement. Less shoulder stress than wide grip. Medial and lateral head dominant.',
  'Triceps Dip':
    'Bodyweight compound. Forward lean = chest bias; upright torso = triceps bias. Long head stretched at bottom.',

  // ── Medicine ball (PT-friendly) ────────────────────────────────────────────
  // Load-limited: med balls rarely reach the ~70% 1RM needed for maximal
  // hypertrophy (ACSM). Best for rehab, teaching, warm-ups, and high-rep work.
  'Overhead Triceps Extension (Medicine Ball)':
    'Overhead position maximally stretches the triceps long head (~60% of triceps mass). Maeo 2023: overhead elbow extension grew all three heads more than neutral, long head most. Strongest med-ball pick for growth — load is the limiter, so push reps near failure.',
  'Goblet Squat (Medicine Ball)':
    'Front-loaded squat; upright torso raises rectus femoris and ab demand. Light load suits warm-ups, rehab, or high-rep finishers.',
  'Romanian Deadlift (Medicine Ball)':
    'Hip-hinge pattern for hamstrings/glutes. Great for grooving the hinge in rehab; load is too light for heavy posterior-chain hypertrophy.',
  'Floor Press (Medicine Ball)':
    'Floor caps the range and spares the shoulder — PT-friendly horizontal press. Load-limited, so treat as high-rep chest/triceps work.',
  'Overhead Press (Medicine Ball)':
    'Light vertical press for the front delt; good for teaching overhead mechanics and rehab. Load is the hypertrophy bottleneck.',
  'Pullover (Medicine Ball)':
    'Stretches the lats and long-head triceps; shoulder-friendly. Light load = high-rep stretch work, not heavy back building.',
  'Weighted Sit-Up (Medicine Ball)':
    'Loaded trunk flexion. Hold the ball at the chest or overhead to add resistance to the abs; raise the lever (overhead) before chasing a heavier ball.',
  'Russian Twist (Medicine Ball)':
    'Rotational oblique work. Control the tempo — momentum steals tension. Move slowly rather than swinging for reps.',
};