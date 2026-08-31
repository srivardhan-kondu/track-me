import { db } from "@/lib/db";

/**
 * Resolves a dictated or typed exercise name to a catalog entry, so its sets
 * can be attributed to muscles.
 *
 * Athletes say "incline dumbbell press" or "incline db press" or just
 * "incline"; matching has to be forgiving without being wrong. Unresolved
 * names are kept as free text rather than rejected — logging the set matters
 * more than classifying it.
 */

type CatalogRow = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
};

type Index = {
  /** Exact normalised name or alias to catalog id. */
  exact: Map<string, string>;
  /** Aliases sorted longest-first, for containment matching. */
  ordered: { key: string; id: string }[];
  loadedAt: number;
};

let index: Index | null = null;
const TTL_MS = 5 * 60 * 1000;

export function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Reduces each word to a rough singular, so "skull crushers" matches
 * "skull crusher" without every plural being listed as an alias. Deliberately
 * shallow — it only needs to cover how gym movements are named, and must not
 * mangle words like "press" or "triceps".
 */
function singularise(key: string): string {
  return key
    .split(" ")
    .map((word) => {
      if (word.length <= 3) return word;
      if (word.endsWith("ies")) return word.slice(0, -3) + "y";
      if (word.endsWith("sses")) return word.slice(0, -2);
      if (/(?:ch|sh|[sxz])es$/.test(word)) return word.slice(0, -2);
      if (word.endsWith("ss")) return word;
      if (word.endsWith("s")) return word.slice(0, -1);
      return word;
    })
    .join(" ");
}

async function getIndex(): Promise<Index> {
  if (index && Date.now() - index.loadedAt < TTL_MS) return index;

  const rows: CatalogRow[] = await db.catalogExercise.findMany({
    select: { id: true, slug: true, name: true, aliases: true },
  });

  const exact = new Map<string, string>();
  const ordered: { key: string; id: string }[] = [];

  for (const row of rows) {
    for (const raw of [row.name, row.slug.replace(/-/g, " "), ...row.aliases]) {
      const key = normalise(raw);
      if (!key) continue;
      // Index both the literal form and its singular, so either matches.
      for (const variant of new Set([key, singularise(key)])) {
        // First writer wins, so a canonical name is never shadowed by an alias.
        if (!exact.has(variant)) exact.set(variant, row.id);
        ordered.push({ key: variant, id: row.id });
      }
    }
  }

  // Longest first: "incline dumbbell press" must beat "dumbbell press".
  ordered.sort((a, b) => b.key.length - a.key.length);

  index = { exact, ordered, loadedAt: Date.now() };
  return index;
}

/** Clears the cache — used after reseeding the catalog. */
export function invalidateExerciseIndex() {
  index = null;
}

export async function resolveExerciseId(name: string): Promise<string | null> {
  const key = normalise(name);
  if (!key) return null;

  const idx = await getIndex();
  const singular = singularise(key);

  const direct = idx.exact.get(key) ?? idx.exact.get(singular);
  if (direct) return direct;

  // Longest alias fully contained in what was said, on word boundaries.
  for (const candidate of new Set([key, singular])) {
    for (const entry of idx.ordered) {
      if (entry.key.length < 4) continue;
      if (candidate === entry.key) return entry.id;
      if (
        candidate.startsWith(entry.key + " ") ||
        candidate.endsWith(" " + entry.key) ||
        candidate.includes(" " + entry.key + " ")
      ) {
        return entry.id;
      }
    }
  }

  return null;
}

/** Resolves many names in one pass, sharing the index. */
export async function resolveExerciseIds(
  names: string[],
): Promise<(string | null)[]> {
  await getIndex();
  return Promise.all(names.map((n) => resolveExerciseId(n)));
}

export type CatalogEntry = {
  id: string;
  name: string;
  equipment: string;
  type: string;
  pattern: string;
};

export type CatalogGroup = {
  groupId: string;
  name: string;
  exercises: CatalogEntry[];
};

/**
 * The catalog arranged for browsing: muscle groups A-Z, and the exercises that
 * train each one alphabetically beneath it.
 *
 * An exercise appears under every group it trains directly, so a hip thrust is
 * found under Glutes and a deadlift under both Legs and Glutes — searching for
 * what you want to train is more natural than recalling an exercise's name.
 */
export async function browseCatalog(query = ""): Promise<CatalogGroup[]> {
  const key = normalise(query);
  const singular = singularise(key);

  const rows = await db.catalogExercise.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      aliases: true,
      equipment: true,
      type: true,
      pattern: true,
      muscles: {
        where: { role: "PRIMARY" },
        select: {
          muscle: {
            select: { group: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  const matches = (row: (typeof rows)[number]) => {
    if (!key) return true;
    const haystack = [row.name, row.slug.replace(/-/g, " "), ...row.aliases]
      .map(normalise)
      .join(" | ");
    return haystack.includes(key) || haystack.includes(singular);
  };

  const groups = new Map<string, CatalogGroup>();

  for (const row of rows) {
    if (!matches(row)) continue;

    const entry: CatalogEntry = {
      id: row.id,
      name: row.name,
      equipment: row.equipment,
      type: row.type,
      pattern: row.pattern,
    };

    // Distinct primary groups — a movement can train more than one.
    const seen = new Set<string>();
    for (const link of row.muscles) {
      const g = link.muscle.group;
      if (seen.has(g.id)) continue;
      seen.add(g.id);

      const bucket = groups.get(g.id) ?? {
        groupId: g.id,
        name: g.name,
        exercises: [],
      };
      bucket.exercises.push(entry);
      groups.set(g.id, bucket);
    }
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
