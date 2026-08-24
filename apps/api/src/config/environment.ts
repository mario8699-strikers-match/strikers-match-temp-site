export type Environment = {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getEnvironment(): Environment {
  const supabaseProjectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /https:\/\/([^.]+)/,
  )?.[1];
  const supabaseDatabasePassword = process.env.SUPABASE_DB_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL
    ?? (supabaseProjectRef && supabaseDatabasePassword
      ? `postgresql://postgres.${supabaseProjectRef}:${encodeURIComponent(supabaseDatabasePassword)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`
      : null);

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 3001),
    databaseUrl: databaseUrl ?? requireEnv("DATABASE_URL"),
  };
}
