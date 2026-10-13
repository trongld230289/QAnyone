import "dotenv/config";

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env (see .env.example)`);
  return v;
}

export const authRequired = (process.env.AUTH_REQUIRED ?? "false") === "true";
