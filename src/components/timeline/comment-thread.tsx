"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addComment, deleteComment } from "@/app/actions/coach";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { initials } from "@/lib/utils";
import { runAction } from "@/lib/run-action";

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null };
};

export function CommentThread({
  comments,
  target,
  viewerId,
  canComment,
}: {
  comments: CommentView[];
  target: { mealId?: string; workoutId?: string; weightEntryId?: string };
  viewerId: string;
  canComment: boolean;
}) {
  const router = useRouter();
  const [composing, setComposing] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || pending) return;

    setPending(true);
    const fd = new FormData();
    fd.set("body", body.trim());
    if (target.mealId) fd.set("mealId", target.mealId);
    if (target.workoutId) fd.set("workoutId", target.workoutId);
    if (target.weightEntryId) fd.set("weightEntryId", target.weightEntryId);

    const res = await runAction(() => addComment(fd));
    setPending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    setBody("");
    setComposing(false);
    router.refresh();
  }

  async function remove(id: string) {
    const res = await runAction(() => deleteComment(id));
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  const hasContent = comments.length > 0 || composing;

  return (
    <div className={hasContent ? "mt-3.5 flex flex-col gap-2.5" : "mt-2.5"}>
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar className="h-6 w-6">
            {c.author.image && <AvatarImage src={c.author.image} alt="" />}
            <AvatarFallback className="text-[8px]">
              {initials(c.author.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 rounded-xl border border-sage-line bg-sage-soft px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[11.5px] font-semibold text-fg">
                {c.author.name ?? "Coach"}
              </span>
              {/*
                Formatted in the reader's own locale and zone, which the server
                cannot know — so the first client render legitimately differs.
              */}
              <span
                suppressHydrationWarning
                className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-fg-dim"
              >
                {new Date(c.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-fg-muted">
              {c.body}
            </p>
          </div>

          {c.author.id === viewerId && (
            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label="Delete comment"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-fg-faint transition-colors hover:text-clay-text"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}

      {canComment && !composing && (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="mono-label flex items-center gap-1.5 transition-colors hover:text-fg"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Add feedback
        </button>
      )}

      {canComment && composing && (
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a shake after your evening walk and we're set."
            rows={2}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setComposing(false);
                setBody("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending || !body.trim()}>
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
