// Stands in for a real build: it passes once the app is wired to Acme.
import { existsSync, readFileSync } from "node:fs";

if (!existsSync("acme.ts")) {
  process.stderr.write("acme.ts is missing. Run `acme init` first.\n");
  process.exit(1);
}
const env = existsSync(".env.local") ? readFileSync(".env.local", "utf-8") : "";
if (!env.includes("DATABASE_URL=")) {
  process.stderr.write(
    "DATABASE_URL isn't in .env.local. Run `acme deploy` first.\n"
  );
  process.exit(1);
}
process.stdout.write("Build succeeded.\n");
