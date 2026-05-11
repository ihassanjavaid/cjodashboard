// Re-export from src/shared/ — the source of truth lives there so the frontend
// can import it without crossing the /api/* URL namespace (Vercel routes
// /api/* to serverless functions in dev and prod).
export { mapRowToSchema } from '../../src/shared/schemaMapper.js';
