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

    const res = await addComment(fd);
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
    const res = await deleteComment(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  const hasContent = comments.length > 0 || composing;

  return (
    <div className={hasContent ? "mt-3 space-y-2" : "mt-2"}>
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2">
          <Avatar className="h-6 w-6">
            {c.author.image && <AvatarImage src={c.author.image} alt="" />}
            <AvatarFallback className="text-[10px]">
              {initials(c.author.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold">
                {c.author.name ?? "Coach"}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {c.body}
            </p>
          </div>

          {c.author.id === viewerId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-muted-foreground"
              onClick={() => remove(c.id)}
              aria-label="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}

      {canComment && !composing && (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Add feedback
        </button>
      )}

      {canComment && composing && (
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Increase protein intake tonight."
            rows={2}
            autoFocus
            className="text-sm"
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
