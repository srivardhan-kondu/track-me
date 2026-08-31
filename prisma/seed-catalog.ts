/**
 * Seeds reference data: the muscle taxonomy and the exercise catalog.
 *
 * Idempotent and safe to re-run — it upserts by stable id or slug, so a
 * deployment can refresh the catalog without touching anyone's logged data.
 */
import { PrismaClient } from "@prisma/client";

import { EXERCISES } from "./data/exercises";
import { MUSCLE_GROUPS } from "./data/taxonomy";

const db = new PrismaClient();

async function main() {
  console.log("Seeding exercise taxonomy…");

  const validMuscles = new Set<string>();

  for (const [gi, group] of MUSCLE_GROUPS.entries()) {
    await db.muscleGroup.upsert({
      where: { id: group.id },
      create: { id: group.id, key: group.key, name: group.name, position: gi },
      update: { key: group.key, name: group.name, position: gi },
    });

    for (const [mi, muscle] of group.muscles.entries()) {
      await db.muscle.upsert({
        where: { id: muscle.id },
        create: { id: muscle.id, name: muscle.name, groupId: group.id, position: mi },
        update: { name: muscle.name, groupId: group.id, position: mi },
      });
      validMuscles.add(muscle.id);
    }
  }

  console.log(`  ${MUSCLE_GROUPS.length} groups, ${validMuscles.size} muscles`);

  // Catch a typo in a muscle id before it silently drops volume attribution.
  const unknown = new Set<string>();
  for (const ex of EXERCISES) {
    for (const id of [...ex.primary, ...(ex.secondary ?? []), ...(ex.stabiliser ?? [])]) {
      if (!validMuscles.has(id)) unknown.add(`${ex.slug} -> ${id}`);
    }
  }
  if (unknown.size > 0) {
    console.error("\nUnknown muscle ids referenced by the catalog:");
    for (const u of unknown) console.error("  " + u);
    throw new Error("Catalog references muscles that do not exist");
  }

  const slugs = EXERCISES.map((e) => e.slug);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error("Duplicate slug in the exercise catalog");
  }

  console.log("Seeding exercise catalog…");

  for (const ex of EXERCISES) {
    const record = await db.catalogExercise.upsert({
      where: { slug: ex.slug },
      create: {
        slug: ex.slug,
        name: ex.name,
        aliases: ex.aliases,
        pattern: ex.pattern,
        type: ex.type,
        equipment: ex.equipment,
        isUnilateral: ex.unilateral ?? false,
      },
      update: {
        name: ex.name,
        aliases: ex.aliases,
        pattern: ex.pattern,
        type: ex.type,
        equipment: ex.equipment,
        isUnilateral: ex.unilateral ?? false,
      },
      select: { id: true },
    });

    // Replace the mapping wholesale so a removed muscle does not linger.
    await db.exerciseMuscle.deleteMany({ where: { catalogExerciseId: record.id } });
    await db.exerciseMuscle.createMany({
      data: [
        ...ex.primary.map((muscleId) => ({ catalogExerciseId: record.id, muscleId, role: "PRIMARY" as const })),
        ...(ex.secondary ?? []).map((muscleId) => ({ catalogExerciseId: record.id, muscleId, role: "SECONDARY" as const })),
        ...(ex.stabiliser ?? []).map((muscleId) => ({ catalogExerciseId: record.id, muscleId, role: "STABILISER" as const })),
      ],
      skipDuplicates: true,
    });
  }

  const [groups, muscles, exercises, mappings] = await Promise.all([
    db.muscleGroup.count(),
    db.muscle.count(),
    db.catalogExercise.count(),
    db.exerciseMuscle.count(),
  ]);

  console.log(`
Reference data ready:
  ${groups} muscle groups
  ${muscles} muscles
  ${exercises} exercises
  ${mappings} muscle mappings
`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
