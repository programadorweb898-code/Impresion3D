import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ensureUserEmailIndex } from '../src/user-email-index.js';
let mongo;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
test('migra el índice legado conservando usuarios, otros índices y unicidad de los correos', async () => {
  const collection = mongoose.connection.collection('migration_users');
  await collection.createIndex({ email: 1 }, { unique: true });
  await collection.createIndex({ name: 1 }, { name: 'keep_name_index' });
  const original = await collection.insertOne({
    name: 'Existente',
    email: 'existing@example.com',
  });
  await Promise.all([
    ensureUserEmailIndex(collection),
    ensureUserEmailIndex(collection),
  ]);
  await ensureUserEmailIndex(collection);
  const indexes = await collection.listIndexes().toArray();
  assert.equal(
    indexes.some((index) => index.name === 'email_1'),
    false,
  );
  assert.ok(indexes.some((index) => index.name === 'keep_name_index'));
  const index = indexes.find((index) => index.name === 'users_email_unique');
  assert.equal(index.unique, true);
  assert.deepEqual(index.partialFilterExpression, {
    email: { $type: 'string' },
  });
  assert.equal(
    (await collection.findOne({ _id: original.insertedId })).email,
    'existing@example.com',
  );
  await collection.insertMany([
    { name: 'Sin correo 1' },
    { name: 'Sin correo 2' },
  ]);
  await assert.rejects(
    collection.insertOne({ email: 'existing@example.com' }),
    { code: 11000 },
  );
  assert.equal(await collection.countDocuments(), 3);
});
test('un índice legado inesperado no se borra automáticamente', async () => {
  const collection = mongoose.connection.collection('unexpected_users');
  await collection.createIndex({ email: 1 }, { name: 'email_1' });
  await assert.rejects(
    ensureUserEmailIndex(collection),
    /Unexpected legacy email index/,
  );
  assert.ok(
    (await collection.listIndexes().toArray()).some(
      (index) => index.name === 'email_1',
    ),
  );
});
