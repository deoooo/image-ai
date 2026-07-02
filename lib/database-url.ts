type DatabaseEnv = Record<string, string | undefined>;

function isPostgresUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (url.protocol === "postgresql:" || url.protocol === "postgres:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function resolveDatabaseUrl(env: DatabaseEnv = process.env): string {
  const candidates = [env.POSTGRES_URL_NON_POOLING, env.DATABASE_URL];
  const connectionString = candidates.find(isPostgresUrl);

  if (!connectionString) {
    throw new Error("A valid POSTGRES_URL_NON_POOLING or DATABASE_URL PostgreSQL connection string is required");
  }

  return connectionString;
}
