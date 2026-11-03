import { User } from './models.js';

export async function ensureUserEmailIndex(collection = User.collection) {
  // Build the replacement first: existing email addresses are never left unprotected.
  await collection.createIndex(
    { email: 1 },
    {
      name: 'users_email_unique',
      unique: true,
      partialFilterExpression: { email: { $type: 'string' } },
    },
  );
  const legacy = (await collection.listIndexes().toArray()).find(
    (index) => index.name === 'email_1',
  );
  if (!legacy) return;
  if (
    Object.keys(legacy.key).length !== 1 ||
    legacy.key.email !== 1 ||
    !legacy.unique ||
    legacy.sparse ||
    legacy.partialFilterExpression ||
    legacy.collation
  )
    throw new Error('Unexpected legacy email index; review before migration');
  try {
    await collection.dropIndex('email_1');
  } catch (error) {
    // Another instance may have completed the same migration during a rolling deploy.
    if (error.code !== 27) throw error;
  }
}
