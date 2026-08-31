import { ADMIN_NAV } from "@/components/layout/nav";
import { AppShell } from "@/components/layout/shell";
import { requireAdmin } from "@/lib/session";

export const metadata = {
  title: { default: "Admin", template: "%s · Admin" },
};

/**
 * Nothing in the console may be served from a cache. Every page here is a
 * statement about the state of the system right now, and a stale one is worse
 * than no page at all — an admin acts on what it says.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Re-reads the column rather than trusting the token: revoking admin has to
  // take effect on the next request, not on the next sign-in.
  const user = await requireAdmin();

  return (
    <AppShell groups={ADMIN_NAV} user={{ ...user, isAdmin: true }} badge="Admin">
      {children}
    </AppShell>
  );
}
