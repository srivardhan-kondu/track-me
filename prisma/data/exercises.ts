/**
 * Exercise catalog.
 *
 * Each entry maps a movement onto the muscle taxonomy so logged sets can be
 * attributed to muscles and muscle groups. `aliases` are what an athlete
 * actually says out loud, and drive resolution of dictated workouts.
 *
 * Roles: PRIMARY does the work, SECONDARY meaningfully assists, STABILISER
 * resists movement without producing it. Only PRIMARY and SECONDARY count
 * toward training volume.
 */

import type {
  Equipment,
  ExerciseType,
  MovementPattern,
} from "@prisma/client";

export type CatalogSeed = {
  slug: string;
  name: string;
  aliases: string[];
  pattern: MovementPattern;
  type: ExerciseType;
  equipment: Equipment;
  unilateral?: boolean;
  primary: string[];
  secondary?: string[];
  stabiliser?: string[];
};

// Shorthand for the muscle bundles that recur across many entries.
const TRICEPS = ["M028", "M029", "M030"];
const QUADS = ["M046", "M047", "M048", "M049"];
const HAMSTRINGS = ["M050", "M051", "M052", "M053"];
const BICEPS = ["M024", "M025"];
const CALVES = ["M060", "M061", "M062"];
const SPINAL = ["M021", "M022", "M023"];
const DEEP_CORE = ["M039", "M035", "M036"];
const ROTATOR_CUFF = ["M009", "M010", "M011", "M012"];

export const EXERCISES: CatalogSeed[] = [
  // --- Horizontal push -----------------------------------------------------
  { slug: "barbell-bench-press", name: "Barbell Bench Press",
    aliases: ["bench press", "bench", "flat bench", "barbell bench", "flat barbell bench"],
    pattern: "HORIZONTAL_PUSH", type: "COMPOUND", equipment: "BARBELL",
    primary: ["M002"], secondary: ["M001", "M003", "M006", ...TRICEPS], stabiliser: ["M004", ...ROTATOR_CUFF] },

  { slug: "incline-barbell-bench-press", name: "Incline Barbell Bench Press",
    aliases: ["incline bench press", "incline bench", "incline barbell press", "incline press", "incline"],
    pattern: "HORIZONTAL_PUSH", type: "COMPOUND", equipment: "BARBELL",
    primary: ["M001"], secondary: ["M002", "M006", ...TRICEPS], stabiliser: ["M004"] },

  { slug: "decline-barbell-bench-press", name: "Decline Barbell Bench Press",
    aliases: ["decline bench press", "decline bench", "decline press", "decline"],
    pattern: "HORIZONTAL_PUSH", type: "COMPOUND", equipment: "BARBELL",
    primary: ["M003"], secondary: ["M002", ...TRICEPS] },

  { slug: "dumbbell-bench-press", name: "Dumbbell Bench Press",
    aliases: ["dumbbell press", "db bench", "dumbbell bench", "flat dumbbell press"],
    pattern: "HORIZONTAL_PUSH", type: "COMPOUND", equipment: "DUMBBELL",
    primary: ["M002"], secondary: ["M001", "M003", "M006", ...TRICEPS], stabiliser: [...ROTATOR_CUFF] },

  { slug: "incline-dumbbell-press", name: "Incline Dumbbell Press",
    aliases: ["incline dumbbell press", "incline db press", "incline dumbbell bench"],
    pattern: "HORIZONTAL_PUSH", type: "COMPOUND", equipment: "DUMBBELL",
    primary: ["M001"], secondary: ["M002", "M006", ...TRICEPS], stabiliser: [...ROTATOR_CUFF] },

  { slug: "machine-chest-press", name: "Machine Chest Press",
    aliases: ["chest press", "machine press", "seated chest press"],
    pattern: "HORIZONTAL_PUSH", type: "COMPOUND", equipment: "MACHINE",
    primary: ["M002"], secondary: ["M001", "M006", ...TRICEPS] },

  { slug: "smith-machine-bench-press", name: "Smith Machine Bench Press",
    aliases: ["smith bench", "smith machine bench", "smith machine press"],
    pattern: "HORIZONTAL_PUSH", type: "COMPOUND", equipment: "SMITH_MACHINE",
    primary: ["M002"], secondary: ["M001", "M006", ...TRICEPS] },

  { slug: "push-up", name: "Push-Up",
    aliases: ["push up", "push ups", "pushup", "pushups", "press up"],
    pattern: "HORIZONTAL_PUSH", type: "COMPOUND", equipment: "BODYWEIGHT",
    primary: ["M002"], secondary: ["M001", "M006", ...TRICEPS], stabiliser: ["M004", ...DEEP_CORE] },

  { slug: "chest-dip", name: "Chest Dip",
    aliases: ["chest dips", "dips", "dip", "parallel bar dips"],
    pattern: "HORIZONTAL_PUSH", type: "COMPOUND", equipment: "BODYWEIGHT",
    primary: ["M003"], secondary: ["M002", ...TRICEPS, "M006"], stabiliser: ["M005"] },

  { slug: "cable-chest-fly", name: "Cable Chest Fly",
    aliases: ["cable fly", "cable flies", "cable flyes", "chest fly", "cable crossover", "pec fly"],
    pattern: "HORIZONTAL_PUSH", type: "ISOLATION", equipment: "CABLE",
    primary: ["M002"], secondary: ["M001", "M003", "M006"] },

  { slug: "pec-deck", name: "Pec Deck",
    aliases: ["pec deck", "machine fly", "butterfly"],
    pattern: "HORIZONTAL_PUSH", type: "ISOLATION", equipment: "MACHINE",
    primary: ["M002"], secondary: ["M001", "M005"] },

  { slug: "dumbbell-chest-fly", name: "Dumbbell Chest Fly",
    aliases: ["dumbbell fly", "db fly", "dumbbell flies", "dumbbell flyes", "chest flyes"],
    pattern: "HORIZONTAL_PUSH", type: "ISOLATION", equipment: "DUMBBELL",
    primary: ["M002"], secondary: ["M001", "M006"] },

  // --- Vertical push -------------------------------------------------------
  { slug: "barbell-overhead-press", name: "Barbell Overhead Press",
    aliases: ["overhead press", "ohp", "military press", "shoulder press", "standing press", "barbell shoulder press"],
    pattern: "VERTICAL_PUSH", type: "COMPOUND", equipment: "BARBELL",
    primary: ["M006"], secondary: ["M007", ...TRICEPS, "M015"], stabiliser: [...DEEP_CORE, ...SPINAL, ...ROTATOR_CUFF] },

  { slug: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press",
    aliases: ["dumbbell shoulder press", "db shoulder press", "seated dumbbell press", "dumbbell overhead press"],
    pattern: "VERTICAL_PUSH", type: "COMPOUND", equipment: "DUMBBELL",
    primary: ["M006"], secondary: ["M007", ...TRICEPS], stabiliser: [...ROTATOR_CUFF] },

  { slug: "arnold-press", name: "Arnold Press",
    aliases: ["arnold press", "arnolds"],
    pattern: "VERTICAL_PUSH", type: "COMPOUND", equipment: "DUMBBELL",
    primary: ["M006"], secondary: ["M007", "M008", ...TRICEPS], stabiliser: [...ROTATOR_CUFF] },

  { slug: "machine-shoulder-press", name: "Machine Shoulder Press",
    aliases: ["machine shoulder press", "shoulder press machine"],
    pattern: "VERTICAL_PUSH", type: "COMPOUND", equipment: "MACHINE",
    primary: ["M006"], secondary: ["M007", ...TRICEPS] },

  { slug: "push-press", name: "Push Press",
    aliases: ["push press"],
    pattern: "VERTICAL_PUSH", type: "POWER", equipment: "BARBELL",
    primary: ["M006"], secondary: [...TRICEPS, ...QUADS, "M041", "M007"], stabiliser: [...DEEP_CORE, ...SPINAL] },

  { slug: "landmine-press", name: "Landmine Press",
    aliases: ["landmine press"],
    pattern: "VERTICAL_PUSH", type: "COMPOUND", equipment: "BARBELL", unilateral: true,
    primary: ["M006"], secondary: ["M001", ...TRICEPS, "M004"], stabiliser: [...DEEP_CORE] },

  { slug: "pike-push-up", name: "Pike Push-Up",
    aliases: ["pike push up", "pike pushup"],
    pattern: "VERTICAL_PUSH", type: "COMPOUND", equipment: "BODYWEIGHT",
    primary: ["M006"], secondary: [...TRICEPS, "M007"], stabiliser: ["M004"] },

  // --- Horizontal pull -----------------------------------------------------
  { slug: "barbell-row", name: "Barbell Row",
    aliases: ["barbell row", "bent over row", "bent-over row", "pendlay row", "bb row"],
    pattern: "HORIZONTAL_PULL", type: "COMPOUND", equipment: "BARBELL",
    primary: ["M013", "M014"], secondary: ["M016", "M018", "M019", "M020", "M008", ...BICEPS, "M026"], stabiliser: [...SPINAL] },

  { slug: "dumbbell-row", name: "Dumbbell Row",
    aliases: ["dumbbell row", "db row", "single arm row", "one arm row", "one-arm dumbbell row"],
    pattern: "HORIZONTAL_PULL", type: "COMPOUND", equipment: "DUMBBELL", unilateral: true,
    primary: ["M013", "M014"], secondary: ["M016", "M018", "M020", ...BICEPS], stabiliser: [...DEEP_CORE, "M022"] },

  { slug: "seated-cable-row", name: "Seated Cable Row",
    aliases: ["cable row", "seated row", "low row"],
    pattern: "HORIZONTAL_PULL", type: "COMPOUND", equipment: "CABLE",
    primary: ["M013", "M014"], secondary: ["M016", "M018", "M019", ...BICEPS, "M026"], stabiliser: [...SPINAL] },

  { slug: "t-bar-row", name: "T-Bar Row",
    aliases: ["t bar row", "t-bar row", "tbar row"],
    pattern: "HORIZONTAL_PULL", type: "COMPOUND", equipment: "BARBELL",
    primary: ["M013", "M014"], secondary: ["M016", "M018", "M020", ...BICEPS], stabiliser: [...SPINAL] },

  { slug: "chest-supported-row", name: "Chest Supported Row",
    aliases: ["chest supported row", "machine row", "seal row"],
    pattern: "HORIZONTAL_PULL", type: "COMPOUND", equipment: "MACHINE",
    primary: ["M013", "M014"], secondary: ["M016", "M017", "M018", "M019", ...BICEPS] },

  { slug: "inverted-row", name: "Inverted Row",
    aliases: ["inverted row", "body row", "australian pull up"],
    pattern: "HORIZONTAL_PULL", type: "COMPOUND", equipment: "BODYWEIGHT",
    primary: ["M013"], secondary: ["M016", "M018", "M008", ...BICEPS], stabiliser: [...DEEP_CORE] },

  { slug: "face-pull", name: "Face Pull",
    aliases: ["face pull", "face pulls"],
    pattern: "HORIZONTAL_PULL", type: "ISOLATION", equipment: "CABLE",
    primary: ["M008"], secondary: ["M016", "M017", "M010", "M011"] },

  { slug: "rear-delt-fly", name: "Rear Delt Fly",
    aliases: ["rear delt fly", "reverse fly", "rear delt raise", "reverse pec deck"],
    pattern: "HORIZONTAL_PULL", type: "ISOLATION", equipment: "DUMBBELL",
    primary: ["M008"], secondary: ["M016", "M018", "M019"] },

  // --- Vertical pull -------------------------------------------------------
  { slug: "pull-up", name: "Pull-Up",
    aliases: ["pull up", "pull ups", "pullup", "pullups"],
    pattern: "VERTICAL_PULL", type: "COMPOUND", equipment: "BODYWEIGHT",
    primary: ["M013", "M014"], secondary: ["M020", "M018", ...BICEPS, "M026"], stabiliser: [...DEEP_CORE, "M017"] },

  { slug: "chin-up", name: "Chin-Up",
    aliases: ["chin up", "chin ups", "chinup", "chinups"],
    pattern: "VERTICAL_PULL", type: "COMPOUND", equipment: "BODYWEIGHT",
    primary: ["M013", "M014"], secondary: [...BICEPS, "M026", "M020"], stabiliser: [...DEEP_CORE] },

  { slug: "lat-pulldown", name: "Lat Pulldown",
    aliases: ["lat pulldown", "pulldown", "lat pull down", "pull down"],
    pattern: "VERTICAL_PULL", type: "COMPOUND", equipment: "CABLE",
    primary: ["M013", "M014"], secondary: ["M020", "M018", ...BICEPS, "M026"] },

  { slug: "straight-arm-pulldown", name: "Straight-Arm Pulldown",
    aliases: ["straight arm pulldown", "straight-arm pulldown", "lat pullover"],
    pattern: "VERTICAL_PULL", type: "ISOLATION", equipment: "CABLE",
    primary: ["M013", "M014"], secondary: ["M020", "M028"] },

  // --- Squat ---------------------------------------------------------------
  { slug: "back-squat", name: "Back Squat",
    aliases: ["squat", "back squat", "barbell squat", "high bar squat", "low bar squat"],
    pattern: "SQUAT", type: "COMPOUND", equipment: "BARBELL",
    primary: [...QUADS], secondary: ["M041", ...HAMSTRINGS, "M054", ...SPINAL], stabiliser: [...DEEP_CORE, "M042"] },

  { slug: "front-squat", name: "Front Squat",
    aliases: ["front squat"],
    pattern: "SQUAT", type: "COMPOUND", equipment: "BARBELL",
    primary: [...QUADS], secondary: ["M041", ...SPINAL, "M015"], stabiliser: [...DEEP_CORE] },

  { slug: "goblet-squat", name: "Goblet Squat",
    aliases: ["goblet squat"],
    pattern: "SQUAT", type: "COMPOUND", equipment: "DUMBBELL",
    primary: [...QUADS], secondary: ["M041", "M054"], stabiliser: [...DEEP_CORE] },

  { slug: "hack-squat", name: "Hack Squat",
    aliases: ["hack squat", "hack squat machine"],
    pattern: "SQUAT", type: "COMPOUND", equipment: "MACHINE",
    primary: [...QUADS], secondary: ["M041", "M054"] },

  { slug: "leg-press", name: "Leg Press",
    aliases: ["leg press", "leg press machine"],
    pattern: "SQUAT", type: "COMPOUND", equipment: "MACHINE",
    primary: [...QUADS], secondary: ["M041", ...HAMSTRINGS, "M054"] },

  { slug: "smith-machine-squat", name: "Smith Machine Squat",
    aliases: ["smith squat", "smith machine squat"],
    pattern: "SQUAT", type: "COMPOUND", equipment: "SMITH_MACHINE",
    primary: [...QUADS], secondary: ["M041", ...HAMSTRINGS] },

  { slug: "box-squat", name: "Box Squat",
    aliases: ["box squat"],
    pattern: "SQUAT", type: "COMPOUND", equipment: "BARBELL",
    primary: [...QUADS], secondary: ["M041", ...HAMSTRINGS, ...SPINAL], stabiliser: [...DEEP_CORE] },

  // --- Hinge ---------------------------------------------------------------
  { slug: "conventional-deadlift", name: "Conventional Deadlift",
    aliases: ["deadlift", "conventional deadlift", "deads"],
    pattern: "HINGE", type: "COMPOUND", equipment: "BARBELL",
    primary: [...HAMSTRINGS, "M041"], secondary: [...SPINAL, ...QUADS, "M013", "M014", "M015", "M016", "M031"], stabiliser: [...DEEP_CORE] },

  { slug: "romanian-deadlift", name: "Romanian Deadlift",
    aliases: ["romanian deadlift", "rdl", "rdls", "stiff leg deadlift", "straight leg deadlift"],
    pattern: "HINGE", type: "COMPOUND", equipment: "BARBELL",
    primary: [...HAMSTRINGS], secondary: ["M041", ...SPINAL, "M054"], stabiliser: [...DEEP_CORE, "M031"] },

  { slug: "sumo-deadlift", name: "Sumo Deadlift",
    aliases: ["sumo deadlift", "sumo"],
    pattern: "HINGE", type: "COMPOUND", equipment: "BARBELL",
    primary: ["M041", ...QUADS], secondary: [...HAMSTRINGS, "M054", "M055", ...SPINAL], stabiliser: [...DEEP_CORE] },

  { slug: "trap-bar-deadlift", name: "Trap Bar Deadlift",
    aliases: ["trap bar deadlift", "hex bar deadlift", "trap bar"],
    pattern: "HINGE", type: "COMPOUND", equipment: "TRAP_BAR",
    primary: [...HAMSTRINGS, "M041", ...QUADS], secondary: [...SPINAL, "M015", "M031"], stabiliser: [...DEEP_CORE] },

  { slug: "good-morning", name: "Good Morning",
    aliases: ["good morning", "good mornings"],
    pattern: "HINGE", type: "COMPOUND", equipment: "BARBELL",
    primary: [...HAMSTRINGS], secondary: ["M041", ...SPINAL], stabiliser: [...DEEP_CORE] },

  { slug: "barbell-hip-thrust", name: "Barbell Hip Thrust",
    aliases: ["hip thrust", "hip thrusts", "barbell hip thrust"],
    pattern: "HINGE", type: "COMPOUND", equipment: "BARBELL",
    primary: ["M041"], secondary: [...HAMSTRINGS, "M042", "M054"], stabiliser: [...DEEP_CORE] },

  { slug: "glute-bridge", name: "Glute Bridge",
    aliases: ["glute bridge", "glute bridges"],
    pattern: "HINGE", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: ["M041"], secondary: [...HAMSTRINGS, "M042"] },

  { slug: "back-extension", name: "Back Extension",
    aliases: ["back extension", "hyperextension", "hyper extension", "45 degree back extension"],
    pattern: "HINGE", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: [...SPINAL], secondary: ["M041", ...HAMSTRINGS] },

  { slug: "kettlebell-swing", name: "Kettlebell Swing",
    aliases: ["kettlebell swing", "kb swing", "swings"],
    pattern: "HINGE", type: "POWER", equipment: "KETTLEBELL",
    primary: ["M041", ...HAMSTRINGS], secondary: [...SPINAL, "M006"], stabiliser: [...DEEP_CORE] },

  { slug: "nordic-curl", name: "Nordic Hamstring Curl",
    aliases: ["nordic curl", "nordic hamstring curl", "nordics"],
    pattern: "HINGE", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: [...HAMSTRINGS], secondary: ["M060", "M061"], stabiliser: [...DEEP_CORE] },

  // --- Lunge ---------------------------------------------------------------
  { slug: "walking-lunge", name: "Walking Lunge",
    aliases: ["walking lunge", "walking lunges", "lunge", "lunges"],
    pattern: "LUNGE", type: "COMPOUND", equipment: "DUMBBELL", unilateral: true,
    primary: [...QUADS, "M041"], secondary: [...HAMSTRINGS, "M054", "M042"], stabiliser: [...DEEP_CORE, "M042", "M043"] },

  { slug: "reverse-lunge", name: "Reverse Lunge",
    aliases: ["reverse lunge", "reverse lunges", "backward lunge"],
    pattern: "LUNGE", type: "COMPOUND", equipment: "DUMBBELL", unilateral: true,
    primary: ["M041", ...QUADS], secondary: [...HAMSTRINGS, "M054"], stabiliser: [...DEEP_CORE, "M042"] },

  { slug: "bulgarian-split-squat", name: "Bulgarian Split Squat",
    aliases: ["bulgarian split squat", "bulgarian split squats", "rear foot elevated split squat", "rfess", "split squat"],
    pattern: "LUNGE", type: "COMPOUND", equipment: "DUMBBELL", unilateral: true,
    primary: [...QUADS, "M041"], secondary: [...HAMSTRINGS, "M054"], stabiliser: ["M042", "M043", ...DEEP_CORE] },

  { slug: "step-up", name: "Step-Up",
    aliases: ["step up", "step ups", "box step up"],
    pattern: "LUNGE", type: "COMPOUND", equipment: "DUMBBELL", unilateral: true,
    primary: [...QUADS, "M041"], secondary: [...HAMSTRINGS, ...CALVES], stabiliser: ["M042", "M043"] },

  // --- Carry ---------------------------------------------------------------
  { slug: "farmers-walk", name: "Farmer's Walk",
    aliases: ["farmers walk", "farmer's walk", "farmers carry", "loaded carry"],
    pattern: "CARRY", type: "COMPOUND", equipment: "DUMBBELL",
    primary: ["M031", "M015"], secondary: ["M016", ...SPINAL, ...QUADS, ...CALVES], stabiliser: [...DEEP_CORE, "M022"] },

  { slug: "suitcase-carry", name: "Suitcase Carry",
    aliases: ["suitcase carry", "suitcase walk"],
    pattern: "CARRY", type: "COMPOUND", equipment: "KETTLEBELL", unilateral: true,
    primary: ["M022", "M037", "M038"], secondary: ["M031", "M015", "M042"], stabiliser: [...DEEP_CORE] },

  // --- Rotation and anti-rotation -----------------------------------------
  { slug: "russian-twist", name: "Russian Twist",
    aliases: ["russian twist", "russian twists"],
    pattern: "ROTATION", type: "ISOLATION", equipment: "MEDICINE_BALL",
    primary: ["M037", "M038"], secondary: ["M035", "M036", "M039"] },

  { slug: "cable-woodchop", name: "Cable Woodchop",
    aliases: ["woodchop", "wood chop", "cable woodchop", "chop"],
    pattern: "ROTATION", type: "ISOLATION", equipment: "CABLE",
    primary: ["M037", "M038"], secondary: ["M039", "M006", "M013"] },

  { slug: "pallof-press", name: "Pallof Press",
    aliases: ["pallof press", "pallof"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "CABLE",
    primary: ["M039", "M037", "M038"], secondary: ["M035", "M022"] },

  { slug: "plank", name: "Plank",
    aliases: ["plank", "planks", "front plank"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: ["M039", "M035", "M036"], secondary: ["M037", "M038", "M004"], stabiliser: [...SPINAL] },

  { slug: "side-plank", name: "Side Plank",
    aliases: ["side plank", "side planks"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "BODYWEIGHT", unilateral: true,
    primary: ["M037", "M038", "M022"], secondary: ["M039", "M042"] },

  { slug: "dead-bug", name: "Dead Bug",
    aliases: ["dead bug", "dead bugs", "deadbug"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: ["M039", "M036"], secondary: ["M035", "M037", "M038"] },

  { slug: "ab-wheel-rollout", name: "Ab Wheel Rollout",
    aliases: ["ab wheel", "ab rollout", "ab wheel rollout", "rollout"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: ["M035", "M036", "M039"], secondary: ["M013", "M004", ...SPINAL] },

  // --- Arms ----------------------------------------------------------------
  { slug: "barbell-curl", name: "Barbell Curl",
    aliases: ["barbell curl", "bicep curl", "biceps curl", "curl", "curls", "bb curl"],
    pattern: "HORIZONTAL_PULL", type: "ISOLATION", equipment: "BARBELL",
    primary: [...BICEPS], secondary: ["M026", "M027", "M034"] },

  { slug: "dumbbell-curl", name: "Dumbbell Curl",
    aliases: ["dumbbell curl", "db curl", "dumbbell bicep curl", "alternating curl"],
    pattern: "HORIZONTAL_PULL", type: "ISOLATION", equipment: "DUMBBELL",
    primary: [...BICEPS], secondary: ["M026", "M027", "M034"] },

  { slug: "hammer-curl", name: "Hammer Curl",
    aliases: ["hammer curl", "hammer curls"],
    pattern: "HORIZONTAL_PULL", type: "ISOLATION", equipment: "DUMBBELL",
    primary: ["M027", "M026"], secondary: [...BICEPS] },

  { slug: "preacher-curl", name: "Preacher Curl",
    aliases: ["preacher curl", "preacher curls", "ez bar curl"],
    pattern: "HORIZONTAL_PULL", type: "ISOLATION", equipment: "EZ_BAR",
    primary: ["M025"], secondary: ["M024", "M026"] },

  { slug: "cable-curl", name: "Cable Curl",
    aliases: ["cable curl", "cable curls"],
    pattern: "HORIZONTAL_PULL", type: "ISOLATION", equipment: "CABLE",
    primary: [...BICEPS], secondary: ["M026", "M027"] },

  { slug: "concentration-curl", name: "Concentration Curl",
    aliases: ["concentration curl"],
    pattern: "HORIZONTAL_PULL", type: "ISOLATION", equipment: "DUMBBELL", unilateral: true,
    primary: ["M025", "M024"], secondary: ["M026"] },

  { slug: "tricep-pushdown", name: "Tricep Pushdown",
    aliases: ["tricep pushdown", "triceps pushdown", "pushdown", "rope pushdown", "cable pushdown"],
    pattern: "VERTICAL_PUSH", type: "ISOLATION", equipment: "CABLE",
    primary: ["M029", "M030"], secondary: ["M028"] },

  { slug: "overhead-tricep-extension", name: "Overhead Tricep Extension",
    aliases: ["overhead tricep extension", "tricep extension", "triceps extension", "overhead extension"],
    pattern: "VERTICAL_PUSH", type: "ISOLATION", equipment: "DUMBBELL",
    primary: ["M028"], secondary: ["M029", "M030"] },

  { slug: "skull-crusher", name: "Skull Crusher",
    aliases: ["skull crusher", "skullcrusher", "lying tricep extension", "french press"],
    pattern: "VERTICAL_PUSH", type: "ISOLATION", equipment: "EZ_BAR",
    primary: ["M028", "M030"], secondary: ["M029"] },

  { slug: "tricep-dip", name: "Tricep Dip",
    aliases: ["tricep dip", "tricep dips", "bench dip"],
    pattern: "VERTICAL_PUSH", type: "COMPOUND", equipment: "BODYWEIGHT",
    primary: [...TRICEPS], secondary: ["M003", "M006"] },

  { slug: "tricep-kickback", name: "Tricep Kickback",
    aliases: ["tricep kickback", "kickback", "kickbacks"],
    pattern: "VERTICAL_PUSH", type: "ISOLATION", equipment: "DUMBBELL", unilateral: true,
    primary: ["M029", "M028"], secondary: ["M030"] },

  { slug: "wrist-curl", name: "Wrist Curl",
    aliases: ["wrist curl", "wrist curls", "forearm curl"],
    pattern: "HORIZONTAL_PULL", type: "ISOLATION", equipment: "DUMBBELL",
    primary: ["M031"], secondary: ["M033"] },

  { slug: "reverse-wrist-curl", name: "Reverse Wrist Curl",
    aliases: ["reverse wrist curl", "reverse curl", "forearm extension"],
    pattern: "HORIZONTAL_PULL", type: "ISOLATION", equipment: "DUMBBELL",
    primary: ["M032"], secondary: ["M027", "M034"] },

  // --- Shoulders (isolation) ----------------------------------------------
  { slug: "lateral-raise", name: "Lateral Raise",
    aliases: ["lateral raise", "lateral raises", "side raise", "side lateral raise", "laterals"],
    pattern: "VERTICAL_PUSH", type: "ISOLATION", equipment: "DUMBBELL",
    primary: ["M007"], secondary: ["M006", "M009", "M015"] },

  { slug: "front-raise", name: "Front Raise",
    aliases: ["front raise", "front raises"],
    pattern: "VERTICAL_PUSH", type: "ISOLATION", equipment: "DUMBBELL",
    primary: ["M006"], secondary: ["M007", "M001"] },

  { slug: "upright-row", name: "Upright Row",
    aliases: ["upright row", "upright rows"],
    pattern: "VERTICAL_PULL", type: "COMPOUND", equipment: "BARBELL",
    primary: ["M007", "M015"], secondary: ["M006", "M016", ...BICEPS] },

  { slug: "barbell-shrug", name: "Barbell Shrug",
    aliases: ["shrug", "shrugs", "barbell shrug", "dumbbell shrug", "trap shrug"],
    pattern: "VERTICAL_PULL", type: "ISOLATION", equipment: "BARBELL",
    primary: ["M015"], secondary: ["M016", "M068", "M031"] },

  // --- Legs (isolation) ----------------------------------------------------
  { slug: "leg-extension", name: "Leg Extension",
    aliases: ["leg extension", "leg extensions", "quad extension"],
    pattern: "SQUAT", type: "ISOLATION", equipment: "MACHINE",
    primary: [...QUADS], secondary: [] },

  { slug: "lying-leg-curl", name: "Lying Leg Curl",
    aliases: ["leg curl", "lying leg curl", "hamstring curl", "leg curls"],
    pattern: "HINGE", type: "ISOLATION", equipment: "MACHINE",
    primary: [...HAMSTRINGS], secondary: ["M060", "M061"] },

  { slug: "seated-leg-curl", name: "Seated Leg Curl",
    aliases: ["seated leg curl", "seated hamstring curl"],
    pattern: "HINGE", type: "ISOLATION", equipment: "MACHINE",
    primary: [...HAMSTRINGS], secondary: ["M060", "M061"] },

  { slug: "standing-calf-raise", name: "Standing Calf Raise",
    aliases: ["calf raise", "calf raises", "standing calf raise"],
    pattern: "GAIT", type: "ISOLATION", equipment: "MACHINE",
    primary: ["M060", "M061"], secondary: ["M062", "M063", "M065"] },

  { slug: "seated-calf-raise", name: "Seated Calf Raise",
    aliases: ["seated calf raise", "seated calf"],
    pattern: "GAIT", type: "ISOLATION", equipment: "MACHINE",
    primary: ["M062"], secondary: ["M060", "M061"] },

  { slug: "hip-adduction", name: "Hip Adduction",
    aliases: ["hip adduction", "adductor machine", "adduction", "inner thigh machine"],
    pattern: "LUNGE", type: "ISOLATION", equipment: "MACHINE",
    primary: ["M054", "M055", "M056"], secondary: ["M057", "M058"] },

  { slug: "hip-abduction", name: "Hip Abduction",
    aliases: ["hip abduction", "abductor machine", "abduction", "outer thigh machine"],
    pattern: "LUNGE", type: "ISOLATION", equipment: "MACHINE",
    primary: ["M042", "M043"], secondary: ["M044", "M045"] },

  { slug: "tibialis-raise", name: "Tibialis Raise",
    aliases: ["tibialis raise", "tib raise", "toe raise"],
    pattern: "GAIT", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: ["M064"], secondary: ["M066"] },

  // --- Core ----------------------------------------------------------------
  { slug: "crunch", name: "Crunch",
    aliases: ["crunch", "crunches", "ab crunch"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: ["M035"], secondary: ["M036", "M037"] },

  { slug: "sit-up", name: "Sit-Up",
    aliases: ["sit up", "sit ups", "situp", "situps"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: ["M035", "M036"], secondary: ["M059", "M037", "M038"] },

  { slug: "hanging-leg-raise", name: "Hanging Leg Raise",
    aliases: ["hanging leg raise", "leg raise", "leg raises", "knee raise"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: ["M036"], secondary: ["M035", "M059", "M037", "M031"] },

  { slug: "cable-crunch", name: "Cable Crunch",
    aliases: ["cable crunch", "kneeling cable crunch"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "CABLE",
    primary: ["M035", "M036"], secondary: ["M037", "M038"] },

  { slug: "mountain-climber", name: "Mountain Climber",
    aliases: ["mountain climber", "mountain climbers"],
    pattern: "CRAWL", type: "CARDIO", equipment: "BODYWEIGHT",
    primary: ["M036", "M039"], secondary: ["M059", "M006", ...QUADS], stabiliser: ["M004"] },

  // --- Power and Olympic ---------------------------------------------------
  { slug: "power-clean", name: "Power Clean",
    aliases: ["power clean", "clean"],
    pattern: "HINGE", type: "OLYMPIC", equipment: "BARBELL",
    primary: [...HAMSTRINGS, "M041", ...QUADS], secondary: [...SPINAL, "M015", "M016", "M006", ...CALVES], stabiliser: [...DEEP_CORE] },

  { slug: "clean-and-jerk", name: "Clean and Jerk",
    aliases: ["clean and jerk", "clean & jerk"],
    pattern: "HINGE", type: "OLYMPIC", equipment: "BARBELL",
    primary: [...HAMSTRINGS, "M041", ...QUADS, "M006"], secondary: [...SPINAL, "M015", ...TRICEPS, ...CALVES], stabiliser: [...DEEP_CORE] },

  { slug: "snatch", name: "Snatch",
    aliases: ["snatch", "barbell snatch"],
    pattern: "HINGE", type: "OLYMPIC", equipment: "BARBELL",
    primary: [...HAMSTRINGS, "M041", ...QUADS], secondary: [...SPINAL, "M015", "M016", "M006", "M007", ...CALVES], stabiliser: [...DEEP_CORE, ...ROTATOR_CUFF] },

  { slug: "box-jump", name: "Box Jump",
    aliases: ["box jump", "box jumps"],
    pattern: "JUMP", type: "POWER", equipment: "BODYWEIGHT",
    primary: [...QUADS, "M041"], secondary: [...HAMSTRINGS, ...CALVES], stabiliser: [...DEEP_CORE] },

  { slug: "broad-jump", name: "Broad Jump",
    aliases: ["broad jump", "standing long jump"],
    pattern: "JUMP", type: "POWER", equipment: "BODYWEIGHT",
    primary: ["M041", ...QUADS], secondary: [...HAMSTRINGS, ...CALVES], stabiliser: [...DEEP_CORE] },

  { slug: "sprint", name: "Sprint",
    aliases: ["sprint", "sprints", "running sprints"],
    pattern: "SPRINT", type: "CARDIO", equipment: "BODYWEIGHT",
    primary: [...HAMSTRINGS, "M041", ...QUADS], secondary: [...CALVES, "M059", "M064"], stabiliser: [...DEEP_CORE] },

  // --- Cardio --------------------------------------------------------------
  { slug: "treadmill-run", name: "Treadmill Run",
    aliases: ["treadmill", "running", "run", "jog", "jogging"],
    pattern: "GAIT", type: "CARDIO", equipment: "MACHINE",
    primary: [...QUADS, ...HAMSTRINGS, ...CALVES], secondary: ["M041", "M064"], stabiliser: [...DEEP_CORE] },

  { slug: "cycling", name: "Cycling",
    aliases: ["cycling", "bike", "stationary bike", "spin", "spinning"],
    pattern: "GAIT", type: "CARDIO", equipment: "MACHINE",
    primary: [...QUADS], secondary: [...HAMSTRINGS, "M041", ...CALVES] },

  { slug: "rowing-machine", name: "Rowing Machine",
    aliases: ["rowing", "rower", "rowing machine", "erg"],
    pattern: "HORIZONTAL_PULL", type: "CARDIO", equipment: "MACHINE",
    primary: [...QUADS, "M013", "M014"], secondary: ["M041", ...HAMSTRINGS, "M016", "M018", ...BICEPS, ...SPINAL] },

  { slug: "elliptical", name: "Elliptical",
    aliases: ["elliptical", "cross trainer"],
    pattern: "GAIT", type: "CARDIO", equipment: "MACHINE",
    primary: [...QUADS, ...HAMSTRINGS], secondary: ["M041", ...CALVES] },

  { slug: "stair-climber", name: "Stair Climber",
    aliases: ["stair climber", "stairmaster", "stairs"],
    pattern: "GAIT", type: "CARDIO", equipment: "MACHINE",
    primary: ["M041", ...QUADS], secondary: [...HAMSTRINGS, ...CALVES] },

  { slug: "jump-rope", name: "Jump Rope",
    aliases: ["jump rope", "skipping", "skipping rope"],
    pattern: "JUMP", type: "CARDIO", equipment: "BODYWEIGHT",
    primary: [...CALVES], secondary: [...QUADS, "M064"], stabiliser: [...DEEP_CORE] },

  // --- Neck ----------------------------------------------------------------
  { slug: "neck-flexion", name: "Neck Flexion",
    aliases: ["neck curl", "neck flexion", "neck harness curl"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: ["M067"], secondary: ["M069"] },

  { slug: "neck-extension", name: "Neck Extension",
    aliases: ["neck extension", "neck extensions"],
    pattern: "ANTI_ROTATION", type: "ISOLATION", equipment: "BODYWEIGHT",
    primary: ["M070"], secondary: ["M068", "M015"] },

  // --- Mobility and rehabilitation ----------------------------------------
  { slug: "external-rotation", name: "Cable External Rotation",
    aliases: ["external rotation", "rotator cuff", "cuff rotation"],
    pattern: "ROTATION", type: "REHABILITATION", equipment: "CABLE", unilateral: true,
    primary: ["M010", "M011"], secondary: ["M008"] },

  { slug: "band-pull-apart", name: "Band Pull-Apart",
    aliases: ["band pull apart", "pull apart", "band pull-apart"],
    pattern: "HORIZONTAL_PULL", type: "REHABILITATION", equipment: "RESISTANCE_BAND",
    primary: ["M008", "M018", "M019"], secondary: ["M016", "M017"] },

  { slug: "couch-stretch", name: "Couch Stretch",
    aliases: ["couch stretch", "hip flexor stretch"],
    pattern: "LUNGE", type: "STRETCH", equipment: "BODYWEIGHT", unilateral: true,
    primary: ["M059", "M046"], secondary: ["M044"] },

  { slug: "hamstring-stretch", name: "Hamstring Stretch",
    aliases: ["hamstring stretch", "toe touch stretch"],
    pattern: "HINGE", type: "STRETCH", equipment: "BODYWEIGHT",
    primary: [...HAMSTRINGS], secondary: ["M060", "M061"] },

  { slug: "worlds-greatest-stretch", name: "World's Greatest Stretch",
    aliases: ["worlds greatest stretch", "world's greatest stretch"],
    pattern: "LUNGE", type: "MOBILITY", equipment: "BODYWEIGHT", unilateral: true,
    primary: ["M059", ...HAMSTRINGS], secondary: ["M037", "M038", "M054"] },
];
