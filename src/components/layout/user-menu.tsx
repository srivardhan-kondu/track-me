"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Settings, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

type Props = {
  name: string | null;
  email: string | null;
  image: string | null;
  role: "ATHLETE" | "COACH";
};

function Items({ role }: { role: Props["role"] }) {
  return (
    <>
      {role === "COACH" && (
        <DropdownMenuItem asChild>
          <Link href="/trainer">
            <Users className="mr-2 h-4 w-4" />
            Coach dashboard
          </Link>
        </DropdownMenuItem>
      )}

      <DropdownMenuItem asChild>
        <Link href="/dashboard/settings">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Link>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </DropdownMenuItem>
    </>
  );
}

/** The card that closes the sidebar: who you are, and which mode you're in. */
export function UserCard({ name, email, image, role }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:bg-hover">
        <Avatar className="h-7 w-7">
          {image && <AvatarImage src={image} alt="" />}
          <AvatarFallback>{initials(name, email)}</AvatarFallback>
        </Avatar>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-fg">
            {name ?? "Athlete"}
          </span>
          <span className="block truncate text-[10.5px] text-fg-dim">
            {role === "COACH" ? "Coach" : "Athlete"}
          </span>
        </span>

        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-[204px]">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-[12.5px] font-semibold text-fg">
            {name ?? "Athlete"}
          </span>
          <span className="block truncate text-[11px] text-fg-dim">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Items role={role} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Avatar-only trigger, for the mobile top bar. */
export function UserMenu({ name, email, image, role }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full transition-opacity hover:opacity-85"
        aria-label="Account menu"
      >
        <Avatar>
          {image && <AvatarImage src={image} alt="" />}
          <AvatarFallback>{initials(name, email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[204px]">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-[12.5px] font-semibold text-fg">
            {name ?? "Athlete"}
          </span>
          <span className="block truncate text-[11px] text-fg-dim">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Items role={role} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
