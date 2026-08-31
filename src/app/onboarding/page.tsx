import fs from "node:fs";
import path from "node:path";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

import { OnboardingFlow } from "./onboarding-flow";

export const metadata = { title: "Welcome" };

/** A portrait is only offered once its file has actually been added. */
function portrait(file: string): string | null {
  const src = `/athletes/${file}`;
  return fs.existsSync(path.join(process.cwd(), "public", src)) ? src : null;
}

export default async function OnboardingPage() {
  const user = await requireUser();

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { onboardedAt: true },
  });

  // Onboarding is a one-time flow; someone who has been through it and comes
  // back to the URL belongs on their dashboard.
  if (record?.onboardedAt) redirect("/dashboard");

  return (
    <OnboardingFlow
      name={user.name?.split(" ")[0] ?? "athlete"}
      portraits={{ FEMALE: portrait("female.webp"), MALE: portrait("male.webp") }}
    />
  );
}
