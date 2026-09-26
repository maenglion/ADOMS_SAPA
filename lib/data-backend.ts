import "server-only";

export type DataBackend = "csv" | "postgres";

/**
 * READ backend selection is explicit. DATABASE_URL alone never changes the
 * application's data source.
 */
export function dataBackend(): DataBackend {
  const value = (process.env.ADOMS_DATA_BACKEND || "csv").trim().toLowerCase();
  if (value === "csv" || value === "postgres") return value;
  throw new Error(`ADOMS_DATA_BACKEND must be csv or postgres (received ${JSON.stringify(value)})`);
}

export function usesPostgresReads(): boolean {
  return dataBackend() === "postgres";
}
