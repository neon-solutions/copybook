# Connect your app to Acme

1. Install a driver:

   ```bash
   npm install @acme/serverless
   ```

2. Create `src/db.ts`:

```typescript title="src/db.ts"
export const db = connect(process.env.DATABASE_URL);
```
