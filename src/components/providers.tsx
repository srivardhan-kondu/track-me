"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

/**
 * Re-asserts the stored theme after hydration.
 *
 * The pre-paint script in the document head puts `dark` on <html>, but React
 * owns that element's className — any tree regeneration replaces it with the
 * class list from the server payload, silently dropping the theme. Re-applying
 * it on mount means a hydration hiccup can never leave the app in the wrong
 * palette.
 */
function ThemeGuard() {
  React.useEffect(() => {
    let dark = true;
    try {
      dark = localStorage.getItem("trackme-theme") !== "light";
    } catch {
      // Private browsing can block storage; Track Me is dark by default.
    }
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeGuard />
      {children}
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
