/**
 * The people, meals and programs behind `scripts/demo-coach.ts`.
 *
 * Every athlete uses an @example.com address, a domain reserved for examples
 * (RFC 2606), so no demo account can collide with a real person's.
 */

export type MealIdea = { title: string; text: string };
export type Diet = {
  breakfast: MealIdea[];
  lunch: MealIdea[];
  snack: MealIdea[];
  dinner: MealIdea[];
  /** Eaten now and then, mostly at weekends. */
  treat: MealIdea[];
};

const meal = (title: string, text: string): MealIdea => ({ title, text });

export const DIETS: Record<string, Diet> = {
  highProtein: {
    breakfast: [
      meal("Eggs and toast", "Three eggs scrambled with two slices of bread and a black coffee."),
      meal("Oats and whey", "80g oats with milk, a banana and one scoop of whey protein."),
      meal("Yogurt bowl", "250g greek yogurt with a handful of nuts and an apple."),
    ],
    lunch: [
      meal("Chicken and rice", "200g chicken breast, one cup of rice and vegetables."),
      meal("Tuna pasta", "One can of tuna with a cup of pasta and vegetables."),
      meal("Steak bowl", "200g beef with one cup of rice and avocado."),
    ],
    snack: [
      meal("Protein shake", "One scoop of whey protein with 300ml milk and a banana."),
      meal("PB toast", "Two slices of bread with two tablespoons of peanut butter."),
      meal("Yogurt and nuts", "200g greek yogurt and a handful of nuts."),
    ],
    dinner: [
      meal("Salmon and potatoes", "200g salmon with potato and vegetables."),
      meal("Chicken and sweet potato", "250g chicken breast with sweet potato and vegetables."),
      meal("Beef and rice", "200g beef with one cup of rice and vegetables."),
    ],
    treat: [
      meal("Burger night", "A burger with potato fries and a soda."),
      meal("Pizza", "Three slices of pizza."),
    ],
  },
  lean: {
    breakfast: [
      meal("Egg white omelette", "Six egg whites with vegetables and one slice of bread."),
      meal("Yogurt and berries", "200g greek yogurt with an apple and a handful of nuts."),
      meal("Overnight oats", "50g oats with milk and half a scoop of whey protein."),
    ],
    lunch: [
      meal("Chicken salad", "150g chicken breast with a big bowl of vegetables and avocado."),
      meal("Salmon bowl", "150g salmon with half a cup of rice and vegetables."),
      meal("Tofu stir fry", "200g tofu with vegetables and half a cup of rice."),
    ],
    snack: [
      meal("Apple and PB", "An apple with one tablespoon of peanut butter."),
      meal("Protein shake", "One scoop of whey protein with water."),
      meal("Greek yogurt", "150g greek yogurt."),
    ],
    dinner: [
      meal("Fish and veg", "200g fish with vegetables and sweet potato."),
      meal("Chicken and greens", "150g chicken breast with vegetables and one tablespoon of olive oil."),
      meal("Turkey-style bowl", "150g chicken breast with half a cup of rice and vegetables."),
    ],
    treat: [
      meal("Pizza with friends", "Two slices of pizza."),
      meal("Brunch", "Two eggs with bread and avocado and a latte coffee."),
    ],
  },
  vegetarian: {
    breakfast: [
      meal("Idli and sambar", "Four idli with a bowl of dal."),
      meal("Paneer toast", "100g paneer on two slices of bread."),
      meal("Oats with milk", "60g oats with milk and a banana."),
    ],
    lunch: [
      meal("Dal and rice", "A bowl of dal with one cup of rice and vegetables."),
      meal("Rajma bowl", "A bowl of rajma with one cup of rice and yogurt."),
      meal("Paneer and roti", "150g paneer with two rotis and vegetables."),
    ],
    snack: [
      meal("Greek yogurt", "200g greek yogurt with nuts."),
      meal("Protein shake", "One scoop of whey protein with milk."),
      meal("Fruit and nuts", "A banana and a handful of nuts."),
    ],
    dinner: [
      meal("Tofu curry", "200g tofu with vegetables and two rotis."),
      meal("Dal and roti", "A bowl of dal with two rotis and vegetables."),
      meal("Dosa night", "Two dosa with a bowl of dal."),
    ],
    treat: [
      meal("Biryani", "A plate of biryani."),
      meal("Pizza", "Two slices of pizza."),
    ],
  },
  endurance: {
    breakfast: [
      meal("Pre-run oats", "80g oats with milk, a banana and a tablespoon of peanut butter."),
      meal("Bagel-style toast", "Two slices of bread with peanut butter and a banana."),
      meal("Eggs and toast", "Two eggs with two slices of bread and a coffee."),
    ],
    lunch: [
      meal("Pasta salad", "Two cups of pasta with chicken breast and vegetables."),
      meal("Rice bowl", "One cup of rice with salmon and avocado."),
      meal("Chicken wrap", "150g chicken breast with bread and vegetables."),
    ],
    snack: [
      meal("Juice and banana", "A glass of orange juice and a banana."),
      meal("Yogurt", "200g yogurt with oats."),
      meal("Recovery shake", "One scoop of whey protein with milk and a banana."),
    ],
    dinner: [
      meal("Salmon and sweet potato", "150g salmon with sweet potato and vegetables."),
      meal("Pasta night", "Two cups of pasta with beef and vegetables."),
      meal("Chicken and rice", "150g chicken breast with one cup of rice."),
    ],
    treat: [
      meal("Post-race burger", "A burger with potato fries."),
      meal("Pizza", "Three slices of pizza."),
    ],
  },
  busyParent: {
    breakfast: [
      meal("Coffee and toast", "A latte coffee and two slices of bread with butter."),
      meal("Eggs", "Two eggs with one slice of bread."),
      meal("Protein shake", "One scoop of whey protein with milk."),
    ],
    lunch: [
      meal("Deli lunch", "Two slices of bread with chicken breast and cheese."),
      meal("Leftover pasta", "One cup of pasta with beef."),
      meal("Salad", "Chicken breast with a bowl of vegetables."),
    ],
    snack: [
      meal("Nuts", "A handful of nuts."),
      meal("Apple and nuts", "An apple and a handful of nuts."),
      meal("Yogurt", "150g greek yogurt."),
    ],
    dinner: [
      meal("Family dinner", "200g beef with potato and vegetables."),
      meal("Chicken and rice", "200g chicken breast with one cup of rice."),
      meal("Takeout", "A plate of biryani."),
    ],
    treat: [
      meal("Pizza night", "Four slices of pizza and a soda."),
      meal("Burger", "A burger with potato fries and a soda."),
    ],
  },
};

export type Lift = { name: string; kg: number | null; sets: number; reps: number; seconds?: number };
export type Session = { title: string; minutes: number; lifts: Lift[] };

const L = (name: string, kg: number | null, sets: number, reps: number): Lift => ({ name, kg, sets, reps });
const cardio = (name: string, minutes: number): Lift => ({ name, kg: null, sets: 1, reps: 0, seconds: minutes * 60 });

export const PROGRAMS: Record<string, Session[]> = {
  ppl: [
    { title: "Push day", minutes: 65, lifts: [L("Barbell Bench Press", 90, 4, 6), L("Incline Dumbbell Press", 32, 3, 10), L("Barbell Overhead Press", 52, 3, 8), L("Lateral Raise", 10, 3, 15), L("Tricep Pushdown", 30, 3, 12)] },
    { title: "Pull day", minutes: 60, lifts: [L("Conventional Deadlift", 160, 3, 5), L("Barbell Row", 80, 4, 8), L("Lat Pulldown", 65, 3, 10), L("Face Pull", 20, 3, 15), L("Hammer Curl", 16, 3, 12)] },
    { title: "Leg day", minutes: 70, lifts: [L("Back Squat", 125, 4, 6), L("Romanian Deadlift", 100, 3, 8), L("Leg Press", 200, 3, 12), L("Lying Leg Curl", 45, 3, 12), L("Standing Calf Raise", 70, 4, 15)] },
  ],
  powerlifting: [
    { title: "Heavy squat", minutes: 80, lifts: [L("Back Squat", 170, 5, 3), L("Front Squat", 110, 3, 5), L("Walking Lunge", 30, 3, 10), L("Plank", null, 3, 1)] },
    { title: "Bench focus", minutes: 75, lifts: [L("Barbell Bench Press", 125, 5, 3), L("Dumbbell Bench Press", 42, 3, 8), L("Skull Crusher", 35, 3, 10), L("Barbell Row", 90, 4, 6)] },
    { title: "Deadlift day", minutes: 80, lifts: [L("Conventional Deadlift", 210, 4, 3), L("Good Morning", 70, 3, 8), L("Pull-Up", null, 4, 8), L("Farmer's Walk", 40, 3, 1)] },
  ],
  glutesUpper: [
    { title: "Lower body", minutes: 60, lifts: [L("Barbell Hip Thrust", 100, 4, 10), L("Romanian Deadlift", 60, 3, 10), L("Bulgarian Split Squat", 12, 3, 10), L("Seated Leg Curl", 35, 3, 12), L("Hip Abduction", 50, 3, 15)] },
    { title: "Upper body", minutes: 55, lifts: [L("Dumbbell Bench Press", 16, 3, 10), L("Lat Pulldown", 45, 3, 10), L("Seated Cable Row", 40, 3, 12), L("Dumbbell Shoulder Press", 12, 3, 10), L("Lateral Raise", 6, 3, 15)] },
    { title: "Full body", minutes: 50, lifts: [L("Goblet Squat", 24, 3, 12), L("Dumbbell Row", 20, 3, 10), L("Push-Up", null, 3, 12), L("Glute Bridge", 60, 3, 15), L("Dead Bug", null, 3, 12)] },
  ],
  endurance: [
    { title: "Easy run", minutes: 50, lifts: [cardio("Treadmill Run", 50)] },
    { title: "Intervals", minutes: 45, lifts: [cardio("Sprint", 20), cardio("Treadmill Run", 25)] },
    { title: "Strength for runners", minutes: 45, lifts: [L("Bulgarian Split Squat", 14, 3, 10), L("Romanian Deadlift", 50, 3, 10), L("Standing Calf Raise", 40, 3, 15), L("Side Plank", null, 3, 1)] },
    { title: "Long ride", minutes: 90, lifts: [cardio("Cycling", 90)] },
  ],
  athletic: [
    { title: "Power", minutes: 70, lifts: [L("Power Clean", 80, 5, 3), L("Box Jump", null, 4, 5), L("Front Squat", 100, 4, 5), L("Sprint", null, 6, 1)] },
    { title: "Upper strength", minutes: 60, lifts: [L("Barbell Bench Press", 95, 4, 6), L("Pull-Up", null, 4, 8), L("Dumbbell Shoulder Press", 26, 3, 10), L("Barbell Curl", 35, 3, 10)] },
    { title: "Lower strength", minutes: 65, lifts: [L("Trap Bar Deadlift", 170, 4, 5), L("Bulgarian Split Squat", 24, 3, 8), L("Nordic Hamstring Curl", null, 3, 6), L("Hanging Leg Raise", null, 3, 12)] },
  ],
  machines: [
    { title: "Full body A", minutes: 50, lifts: [L("Leg Press", 140, 3, 12), L("Machine Chest Press", 55, 3, 10), L("Lat Pulldown", 55, 3, 10), cardio("Treadmill Run", 15)] },
    { title: "Full body B", minutes: 45, lifts: [L("Goblet Squat", 22, 3, 12), L("Machine Shoulder Press", 35, 3, 10), L("Seated Cable Row", 50, 3, 12), cardio("Elliptical", 15)] },
  ],
  beginner: [
    { title: "Full body", minutes: 45, lifts: [L("Goblet Squat", 20, 3, 10), L("Dumbbell Bench Press", 18, 3, 10), L("Dumbbell Row", 20, 3, 10), L("Plank", null, 3, 1)] },
    { title: "Full body B", minutes: 45, lifts: [L("Leg Press", 100, 3, 12), L("Push-Up", null, 3, 10), L("Lat Pulldown", 45, 3, 10), L("Glute Bridge", 40, 3, 12)] },
  ],
};

export type Athlete = {
  name: string;
  email: string;
  gender: "MALE" | "FEMALE";
  age: number;
  heightCm: number;
  units: "US" | "METRIC";
  timeZone: string;
  diet: keyof typeof DIETS;
  program: keyof typeof PROGRAMS;
  /** Kilograms at the end of the history (today). */
  weightKg: number;
  /** Change per day, kg: negative for a cut. */
  trend: number;
  targetCalories: number | null;
  targetWeightKg: number | null;
  waterGoalMl: number;
  /** Chance of logging on any given day. */
  logRate: number;
  /** Training days a week. */
  trainsPerWeek: number;
  /** Days of history. */
  days: number;
  /** Days, counting back from today, with nothing logged at all. */
  quietFor?: number;
  /**
   * Which of the last six days (1 = yesterday) were missed. Fixed rather than
   * rolled, so the roster always shows the same mix of signals.
   */
  missed?: number[];
  /** Scales every meal: a cut eats less, a bulk more. */
  portion: number;
};

export const ATHLETES: Athlete[] = [
  { name: "Jordan Miller", missed: [4], email: "jordan.miller@example.com", gender: "MALE", age: 29, heightCm: 183, units: "US", timeZone: "America/New_York", diet: "highProtein", program: "ppl", weightKg: 88.4, trend: -0.075, targetCalories: 2300, targetWeightKg: 84, waterGoalMl: 3500, logRate: 0.96, trainsPerWeek: 5, days: 42, portion: 1.0 },
  { name: "Sofia Ramirez", missed: [], email: "sofia.ramirez@example.com", gender: "FEMALE", age: 26, heightCm: 165, units: "US", timeZone: "America/Los_Angeles", diet: "lean", program: "glutesUpper", weightKg: 63.1, trend: -0.04, targetCalories: 1750, targetWeightKg: 61, waterGoalMl: 2700, logRate: 0.93, trainsPerWeek: 4, days: 42, portion: 1.0 },
  { name: "Marcus Johnson", missed: [], email: "marcus.johnson@example.com", gender: "MALE", age: 34, heightCm: 178, units: "US", timeZone: "America/Chicago", diet: "highProtein", program: "powerlifting", weightKg: 93.2, trend: 0.04, targetCalories: 3300, targetWeightKg: 95, waterGoalMl: 4000, logRate: 0.9, trainsPerWeek: 4, days: 42, portion: 1.35 },
  { name: "Emily Chen", missed: [], email: "emily.chen@example.com", gender: "FEMALE", age: 31, heightCm: 168, units: "US", timeZone: "America/Los_Angeles", diet: "endurance", program: "endurance", weightKg: 57.8, trend: -0.005, targetCalories: 2400, targetWeightKg: null, waterGoalMl: 3200, logRate: 0.94, trainsPerWeek: 5, days: 42, portion: 1.1 },
  { name: "Aisha Patel", missed: [], email: "aisha.patel@example.com", gender: "FEMALE", age: 28, heightCm: 160, units: "US", timeZone: "America/New_York", diet: "vegetarian", program: "glutesUpper", weightKg: 66.0, trend: -0.05, targetCalories: 1700, targetWeightKg: 62, waterGoalMl: 2600, logRate: 0.92, trainsPerWeek: 4, days: 42, portion: 0.9 },
  { name: "Olivia Bennett", missed: [2], email: "olivia.bennett@example.com", gender: "FEMALE", age: 24, heightCm: 170, units: "US", timeZone: "America/New_York", diet: "lean", program: "athletic", weightKg: 64.5, trend: 0.01, targetCalories: 2200, targetWeightKg: null, waterGoalMl: 3000, logRate: 0.97, trainsPerWeek: 5, days: 42, portion: 1.15 },
  { name: "Ryan O’Connor", missed: [6], email: "ryan.oconnor@example.com", gender: "MALE", age: 27, heightCm: 180, units: "US", timeZone: "America/New_York", diet: "highProtein", program: "ppl", weightKg: 84.0, trend: 0.025, targetCalories: 2900, targetWeightKg: 86, waterGoalMl: 3500, logRate: 0.9, trainsPerWeek: 5, days: 42, portion: 1.2 },
  { name: "Hannah Scott", missed: [3], email: "hannah.scott@example.com", gender: "FEMALE", age: 33, heightCm: 172, units: "US", timeZone: "America/Denver", diet: "vegetarian", program: "glutesUpper", weightKg: 71.6, trend: -0.05, targetCalories: 1850, targetWeightKg: 66, waterGoalMl: 2800, logRate: 0.88, trainsPerWeek: 3, days: 42, portion: 1.0 },
  { name: "Mia Rossi", missed: [], email: "mia.rossi@example.com", gender: "FEMALE", age: 30, heightCm: 167, units: "METRIC", timeZone: "Europe/London", diet: "lean", program: "glutesUpper", weightKg: 62.2, trend: -0.035, targetCalories: 1800, targetWeightKg: 60, waterGoalMl: 2500, logRate: 0.9, trainsPerWeek: 4, days: 42, portion: 1.0 },
  { name: "Tyler Brooks", missed: [2, 5], email: "tyler.brooks@example.com", gender: "MALE", age: 21, heightCm: 188, units: "US", timeZone: "America/Denver", diet: "highProtein", program: "athletic", weightKg: 82.5, trend: 0.06, targetCalories: 3400, targetWeightKg: 86, waterGoalMl: 4000, logRate: 0.62, trainsPerWeek: 4, days: 42, portion: 1.3 },
  { name: "Daniel Kim", missed: [1, 3, 4], email: "daniel.kim@example.com", gender: "MALE", age: 39, heightCm: 175, units: "US", timeZone: "America/Chicago", diet: "busyParent", program: "machines", weightKg: 90.3, trend: -0.03, targetCalories: 2200, targetWeightKg: 84, waterGoalMl: 3000, logRate: 0.58, trainsPerWeek: 3, days: 42, portion: 1.0 },
  { name: "Chris Walker", missed: [], email: "chris.walker@example.com", gender: "MALE", age: 45, heightCm: 179, units: "US", timeZone: "America/Phoenix", diet: "busyParent", program: "machines", weightKg: 101.8, trend: -0.09, targetCalories: 2300, targetWeightKg: 92, waterGoalMl: 3200, logRate: 0.9, trainsPerWeek: 3, days: 42, quietFor: 5, portion: 1.1 },
  { name: "Ethan Price", missed: [], email: "ethan.price@example.com", gender: "MALE", age: 19, heightCm: 176, units: "US", timeZone: "America/New_York", diet: "highProtein", program: "beginner", weightKg: 70.4, trend: 0.05, targetCalories: 2800, targetWeightKg: 75, waterGoalMl: 3000, logRate: 1, trainsPerWeek: 3, days: 6, portion: 1.1 },
];

/** Asked for access, not yet accepted: shows the invite flow on the roster. */
export const PENDING = [
  { name: "Grace Lee", email: "grace.lee@example.com" },
  { name: "Noah Turner", email: "noah.turner@example.com" },
];

/** Things a coach writes. `{name}` is the athlete's first name. */
export const COACH_ON_MEAL = [
  "Great protein hit here, {name}. This is exactly the kind of meal I want most days.",
  "Protein is a bit light on this one. Add a scoop of whey or another palm of chicken.",
  "Nice. Keep the carbs around training like this.",
  "Love how consistent your breakfasts are. That’s what moves the scale.",
  "This one’s fine, just watch the oils when you’re cooking at home.",
  "Good call keeping portions steady even on a rest day.",
];
export const COACH_ON_WORKOUT = [
  "Strong session, {name}. Next week add 2.5 kg to the first lift and keep the reps.",
  "That top set moved well. Leave one rep in the tank on the last set.",
  "PR pace. Make sure you’re sleeping 7+ hours this week to keep it going.",
  "Good volume. Let’s keep rest periods to 2 minutes on the accessories.",
  "Solid work. Film your next top set so I can check the bar path.",
  "Nice. That’s three sessions this week, exactly on plan.",
];
export const COACH_ON_WEIGHT = [
  "Trend is right on target, {name}. Don’t chase the daily number.",
  "Bit of a jump overnight, almost certainly water from yesterday’s carbs. Stay the course.",
  "Down again this week. Great job sticking to the plan.",
];
export const REPLIES = [
  "Thanks coach! 🙌",
  "Got it, will do.",
  "Will add that tomorrow.",
  "Felt really good today 💪",
  "Makes sense, thanks!",
  "On it.",
];
