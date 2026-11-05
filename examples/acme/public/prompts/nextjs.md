# Connect a Next.js app to Acme

Run this in the root of an existing Next.js App Router project.

1. Install the driver:

   ```bash
   npm install @acme/serverless
   ```

2. Add `DATABASE_URL` to `.env.local` and ask the user to paste their connection string.

3. Create a shared client:

```typescript title="lib/db.ts"
import { acme } from "@acme/serverless";

export const db = acme(process.env.DATABASE_URL ?? "");
```

4. Query it from a Server Component, then run `npm run build` and fix any errors.
