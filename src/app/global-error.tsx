"use client";

import * as React from "react";

/**
 * The last resort: an error thrown by the root layout itself, where no app
 * chrome and no stylesheet can be assumed. It replaces the whole document, so
 * it carries its own <html>/<body> and inlines the few styles it needs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#000a11",
          color: "#fff",
          font: "400 14px/1.6 ui-sans-serif, system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, width: "100%" }}>
          <h1 style={{ font: "700 22px/1.3 inherit", margin: 0 }}>
            Track Me hit an error
          </h1>
          <p style={{ color: "#8a8c8f", marginTop: 10 }}>
            Nothing you logged is affected. Reload, and if it keeps happening
            send us the detail below.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              height: 44,
              padding: "0 20px",
              borderRadius: 14,
              border: 0,
              background: "#9878e6",
              color: "#000a11",
              font: "600 14px inherit",
            }}
          >
            Reload
          </button>

          <pre
            style={{
              marginTop: 26,
              padding: 14,
              borderRadius: 14,
              border: "1px solid #1b2026",
              background: "#061018",
              color: "#8a8c8f",
              fontSize: 11.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error.message || "Unknown error"}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        </div>
      </body>
    </html>
  );
}
