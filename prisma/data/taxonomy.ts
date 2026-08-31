/**
 * Muscle taxonomy, v1.0.
 *
 * Identifiers are stable and referenced by the exercise catalog, so they must
 * not be renumbered — add new entries at the end of a group instead.
 */

export type MuscleSeed = { id: string; name: string };
export type MuscleGroupSeed = {
  id: string;
  key: string;
  name: string;
  muscles: MuscleSeed[];
};

export const MUSCLE_GROUPS: MuscleGroupSeed[] = [
  {
    id: "MG001",
    key: "chest",
    name: "Chest",
    muscles: [
      { id: "M001", name: "Upper Chest" },
      { id: "M002", name: "Mid Chest" },
      { id: "M003", name: "Lower Chest" },
      { id: "M004", name: "Serratus Anterior" },
      { id: "M005", name: "Pectoralis Minor" },
    ],
  },
  {
    id: "MG002",
    key: "shoulders",
    name: "Shoulders",
    muscles: [
      { id: "M006", name: "Front Delts" },
      { id: "M007", name: "Side Delts" },
      { id: "M008", name: "Rear Delts" },
      { id: "M009", name: "Supraspinatus" },
      { id: "M010", name: "Infraspinatus" },
      { id: "M011", name: "Teres Minor" },
      { id: "M012", name: "Subscapularis" },
    ],
  },
  {
    id: "MG003",
    key: "back",
    name: "Back",
    muscles: [
      { id: "M013", name: "Upper Lats" },
      { id: "M014", name: "Lower Lats" },
      { id: "M015", name: "Upper Traps" },
      { id: "M016", name: "Mid Traps" },
      { id: "M017", name: "Lower Traps" },
      { id: "M018", name: "Rhomboid Major" },
      { id: "M019", name: "Rhomboid Minor" },
      { id: "M020", name: "Teres Major" },
      { id: "M021", name: "Erector Spinae" },
      { id: "M022", name: "Quadratus Lumborum" },
      { id: "M023", name: "Multifidus" },
    ],
  },
  {
    id: "MG004",
    key: "arms",
    name: "Arms",
    muscles: [
      { id: "M024", name: "Biceps Long Head" },
      { id: "M025", name: "Biceps Short Head" },
      { id: "M026", name: "Brachialis" },
      { id: "M027", name: "Brachioradialis" },
      { id: "M028", name: "Triceps Long Head" },
      { id: "M029", name: "Triceps Lateral Head" },
      { id: "M030", name: "Triceps Medial Head" },
      { id: "M031", name: "Forearm Flexors" },
      { id: "M032", name: "Forearm Extensors" },
      { id: "M033", name: "Pronators" },
      { id: "M034", name: "Supinators" },
    ],
  },
  {
    id: "MG005",
    key: "core",
    name: "Core",
    muscles: [
      { id: "M035", name: "Upper Abs" },
      { id: "M036", name: "Lower Abs" },
      { id: "M037", name: "External Obliques" },
      { id: "M038", name: "Internal Obliques" },
      { id: "M039", name: "Transverse Abdominis" },
      { id: "M040", name: "Pelvic Floor" },
    ],
  },
  {
    id: "MG006",
    key: "glutes",
    name: "Glutes",
    muscles: [
      { id: "M041", name: "Glute Maximus" },
      { id: "M042", name: "Glute Medius" },
      { id: "M043", name: "Glute Minimus" },
      { id: "M044", name: "Tensor Fasciae Latae" },
      { id: "M045", name: "Piriformis" },
    ],
  },
  {
    id: "MG007",
    key: "legs",
    name: "Legs",
    muscles: [
      { id: "M046", name: "Rectus Femoris" },
      { id: "M047", name: "Vastus Lateralis" },
      { id: "M048", name: "Vastus Medialis" },
      { id: "M049", name: "Vastus Intermedius" },
      { id: "M050", name: "Biceps Femoris Long Head" },
      { id: "M051", name: "Biceps Femoris Short Head" },
      { id: "M052", name: "Semitendinosus" },
      { id: "M053", name: "Semimembranosus" },
      { id: "M054", name: "Adductor Magnus" },
      { id: "M055", name: "Adductor Longus" },
      { id: "M056", name: "Adductor Brevis" },
      { id: "M057", name: "Gracilis" },
      { id: "M058", name: "Pectineus" },
      { id: "M059", name: "Iliopsoas" },
      { id: "M060", name: "Gastrocnemius Medial" },
      { id: "M061", name: "Gastrocnemius Lateral" },
      { id: "M062", name: "Soleus" },
      { id: "M063", name: "Plantaris" },
      { id: "M064", name: "Tibialis Anterior" },
      { id: "M065", name: "Tibialis Posterior" },
      { id: "M066", name: "Peroneals" },
    ],
  },
  {
    id: "MG008",
    key: "neck",
    name: "Neck",
    muscles: [
      { id: "M067", name: "Sternocleidomastoid" },
      { id: "M068", name: "Levator Scapulae" },
      { id: "M069", name: "Scalenes" },
      { id: "M070", name: "Splenius Capitis" },
    ],
  },
];

/** Display labels for the enum values used across the UI. */
export const PATTERN_LABELS = {
  HORIZONTAL_PUSH: "Horizontal Push",
  VERTICAL_PUSH: "Vertical Push",
  HORIZONTAL_PULL: "Horizontal Pull",
  VERTICAL_PULL: "Vertical Pull",
  SQUAT: "Squat",
  HINGE: "Hinge",
  LUNGE: "Lunge",
  CARRY: "Carry",
  ROTATION: "Rotation",
  ANTI_ROTATION: "Anti Rotation",
  GAIT: "Gait",
  JUMP: "Jump",
  SPRINT: "Sprint",
  CRAWL: "Crawl",
} as const;

export const TYPE_LABELS = {
  COMPOUND: "Compound",
  ISOLATION: "Isolation",
  POWER: "Power",
  OLYMPIC: "Olympic",
  CARDIO: "Cardio",
  MOBILITY: "Mobility",
  STRETCH: "Stretch",
  REHABILITATION: "Rehabilitation",
} as const;

export const EQUIPMENT_LABELS = {
  BARBELL: "Barbell",
  DUMBBELL: "Dumbbell",
  MACHINE: "Machine",
  CABLE: "Cable",
  SMITH_MACHINE: "Smith Machine",
  BODYWEIGHT: "Bodyweight",
  RESISTANCE_BAND: "Resistance Band",
  KETTLEBELL: "Kettlebell",
  TRAP_BAR: "Trap Bar",
  EZ_BAR: "EZ Bar",
  MEDICINE_BALL: "Medicine Ball",
  SUSPENSION_TRAINER: "Suspension Trainer",
} as const;
