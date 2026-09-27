import "server-only";

export type DataBackend = "csv" | "postgres" | "read-server";

/**
 * READ backend selection is explicit. DATABASE_URL alone never changes the
 * application's data source.
 */
export function dataBackend(): DataBackend {
  const value = (process.env.ADOMS_DATA_BACKEND || "csv").trim().toLowerCase();
  if (value === "csv" || value === "postgres" || value === "read-server") return value;
  throw new Error(`ADOMS_DATA_BACKEND must be csv, postgres, or read-server (received ${JSON.stringify(value)})`);
}

export function usesPostgresReads(): boolean {
  return dataBackend() === "postgres";
}

export function usesReadServer(): boolean {
  return dataBackend() === "read-server";
}
