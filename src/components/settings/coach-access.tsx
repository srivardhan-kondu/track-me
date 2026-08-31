"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { respondToCoachRequest, revokeCoachAccess } from "@/app/actions/coach";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { runAction, type ActionResult } from "@/lib/run-action";
import { initials } from "@/lib/utils";

type Person = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type Link = { coach: Person; createdAt: Date };

/**
 * Where an athlete decides who may read their training log.
 *
 * A coach asking to monitor someone is only ever a request. Nothing of theirs
 * is visible until it is accepted here, and accepting can be undone whenever
 * they like.
 */
export function CoachAccess({
  pending,
  accepted,
  email,
}: {
  pending: Link[];
  accepted: Link[];
  email: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function act(
    coachId: string,
    run: () => Promise<ActionResult>,
    done: string,
  ) {
    if (busy) return;
    setBusy(coachId);
    const res = await runAction(run);
    setBusy(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(done);
    router.refresh();
  }

  if (pending.length === 0 && accepted.length === 0) {
    return (
      <p className="text-[12.5px] leading-relaxed text-fg-muted">
        No coach is monitoring you yet. Ask your trainer to request access using
        the email you signed up with,{" "}
        <span className="font-mono text-[12px] text-fg">{email}</span>. Nothing
        is shared until you allow it here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {pending.length > 0 && (
        <div>
          <p className="mono-label mb-2.5">Asking for access</p>
          <ul className="flex flex-col gap-3">
            {pending.map(({ coach }) => (
              <Row key={coach.id} person={coach} note="Cannot see anything yet">
                <Button
                  size="sm"
                  onClick={() =>
                    act(
                      coach.id,
                      () => respondToCoachRequest(coach.id, true),
                      "They can now see your log.",
                    )
                  }
                  disabled={busy === coach.id}
                >
                  {busy === coach.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Check />
                  )}
                  Allow
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    act(
                      coach.id,
                      () => respondToCoachRequest(coach.id, false),
                      "Request declined.",
                    )
                  }
                  disabled={busy === coach.id}
                >
                  <X />
                  Decline
                </Button>
              </Row>
            ))}
          </ul>
        </div>
      )}

      {accepted.length > 0 && (
        <div>
          <p className="mono-label mb-2.5">Can see your log</p>
          <ul className="flex flex-col gap-3">
            {accepted.map(({ coach, createdAt }) => (
              <Row
                key={coach.id}
                person={coach}
                note={`Since ${createdAt.toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}`}
              >
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    act(
                      coach.id,
                      () => revokeCoachAccess(coach.id),
                      "Access removed.",
                    )
                  }
                  disabled={busy === coach.id}
                >
                  {busy === coach.id && <Loader2 className="animate-spin" />}
                  Remove
                </Button>
              </Row>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  person,
  note,
  children,
}: {
  person: Person;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      <Avatar>
        {person.image && <AvatarImage src={person.image} alt="" />}
        <AvatarFallback>{initials(person.name, person.email)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-fg">
          {person.name ?? "Coach"}
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-fg-muted">
          {person.email} · {note}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </li>
  );
}
