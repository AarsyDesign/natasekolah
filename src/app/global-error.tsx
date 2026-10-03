"use client";

/**
 * Boundary paling luar (root layout) — Phase 12.2.
 *
 * Berbeda dengan `app/error.tsx`, boundary ini menggantikan seluruh layout
 * sehingga wajib merender <html> dan <body> sendiri. Dipakai saat root
 * layout sendiri yang crash.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#fbfbfa",
          color: "#18181b",
        }}
      >
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: "100%",
              background: "#fff",
              border: "1px solid #e7e5e4",
              borderRadius: 16,
              padding: 24,
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: 16, margin: "0 0 8px" }}>
              Aplikasi gagal dimuat
            </h1>
            <p style={{ fontSize: 14, color: "#57534e", margin: 0 }}>
              Coba muat ulang halaman. Jika berlanjut, hubungi admin lembaga.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                minHeight: 44,
                width: "100%",
                borderRadius: 8,
                border: "none",
                background: "#0f766e",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Muat Ulang
            </button>
            {error?.digest ? (
              <p style={{ fontSize: 11, color: "#a8a29e", marginTop: 12 }}>
                Kode gangguan: {error.digest}
              </p>
            ) : null}
          </div>
        </main>
      </body>
    </html>
  );
}
