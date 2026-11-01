import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Order } from '../src/models.js';
import {
  createOrderNotifier,
  deliverOrderNotifications,
} from '../src/order-notifications.js';
let mongo;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
const data = {
  userId: new mongoose.Types.ObjectId(),
  items: [{ name: 'Pieza', quantity: 2 }],
  totalCents: 20100,
  currency: 'ARS',
};
test('dos workers concurrentes reclaman un aviso una sola vez y no envían pedidos históricos', async () => {
  await Order.collection.insertOne({
    ...data,
    _id: new mongoose.Types.ObjectId(),
  });
  const order = await Order.create(data),
    sent = [];
  const send = async (doc) => sent.push(String(doc._id));
  await Promise.all([
    deliverOrderNotifications(send),
    deliverOrderNotifications(send),
  ]);
  assert.deepEqual(sent, [String(order._id)]);
  await deliverOrderNotifications(send);
  assert.equal(sent.length, 1);
  const stored = await Order.findById(order._id).select('+notification.state');
  assert.equal(stored.notification.state, 'sent');
});
test('fallos reintentan con espera y terminan en failed al quinto intento', async () => {
  const order = await Order.create(data),
    start = Date.now();
  let attempts = 0;
  const fail = async () => {
    attempts++;
    throw new Error('provider');
  };
  await deliverOrderNotifications(fail, new Date(start));
  await deliverOrderNotifications(fail, new Date(start));
  assert.equal(attempts, 1);
  for (let i = 1; i < 5; i++)
    await deliverOrderNotifications(fail, new Date(start + i * 600000));
  assert.equal(attempts, 5);
  const stored = await Order.findById(order._id).select(
    '+notification.state +notification.attempts',
  );
  assert.equal(stored.notification.state, 'failed');
  await deliverOrderNotifications(fail, new Date(start + 99999999));
  assert.equal(attempts, 5);
});
test('lease vencido se recupera; Resend usa destino fijo e idempotencia y no envía notas del cliente', async () => {
  const order = await Order.create({
    ...data,
    notes: 'Texto privado',
    notification: { state: 'processing', attempts: 1, leaseUntil: new Date(0) },
  });
  const requests = [];
  const send = createOrderNotifier(
    {
      RESEND_API_KEY: 'test-only',
      EMAIL_FROM: 'test@example.com',
      ORDER_NOTIFICATION_EMAIL: 'owner@example.com',
    },
    async (url, options) => {
      requests.push({ url, options });
      return { ok: true };
    },
  );
  await deliverOrderNotifications(send);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].options.headers['Idempotency-Key'],
    'order-' + order._id,
  );
  assert.deepEqual(JSON.parse(requests[0].options.body).to, [
    'owner@example.com',
  ]);
  assert.ok(!requests[0].options.body.includes('Texto privado'));
  assert.equal(createOrderNotifier({}), null);
  assert.equal(
    createOrderNotifier({ ORDER_NOTIFICATION_EMAIL: 'owner@example.com' }),
    null,
  );
});
