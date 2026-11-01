import { createMailer } from './mail.js';
import { formatMoney } from '@impresion3d/shared';
import { Order } from './models.js';
import { z } from 'zod';
export function createOrderNotifier(env = {}, transport = fetch) {
  if (!env.ORDER_NOTIFICATION_EMAIL) return null;
  const recipient = z.email().parse(env.ORDER_NOTIFICATION_EMAIL);
  const sendMail = createMailer(env, transport);
  if (!sendMail) {
    console.warn(
      JSON.stringify({ event: 'order_notifications_not_configured' }),
    );
    return null;
  }
  return async (order) => {
    const total = formatMoney(order.totalCents, order.currency);
    await sendMail({
      email: recipient,
      subject: 'Nuevo pedido #' + String(order._id).slice(-6).toUpperCase(),
      text: `Recibiste un nuevo pedido de ${order.items.reduce((sum, item) => sum + item.quantity, 0)} unidades por ${total}. Ingresá a Administración para revisar los detalles.`,
      idempotencyKey: 'order-' + order._id,
    });
  };
}
export async function deliverOrderNotifications(send, now = new Date()) {
  if (!send) return;
  // A lease plus the provider's idempotency key protects against concurrent instances and restarts.
  for (let count = 0; count < 5; count++) {
    const leaseUntil = new Date(now.getTime() + 60000);
    const order = await Order.findOneAndUpdate(
      {
        'notification.attempts': { $lt: 5 },
        $or: [
          {
            'notification.state': 'pending',
            'notification.dueAt': { $lte: now },
          },
          {
            'notification.state': 'processing',
            'notification.leaseUntil': { $lte: now },
          },
        ],
      },
      {
        $set: {
          'notification.state': 'processing',
          'notification.leaseUntil': leaseUntil,
        },
        $inc: { 'notification.attempts': 1 },
      },
      { new: true },
    ).select(
      '+notification.state +notification.attempts +notification.dueAt +notification.leaseUntil',
    );
    if (!order) break;
    const filter = {
      _id: order._id,
      'notification.state': 'processing',
      'notification.leaseUntil': leaseUntil,
    };
    try {
      await send(order);
      await Order.updateOne(filter, {
        $set: {
          'notification.state': 'sent',
          'notification.sentAt': new Date(),
        },
        $unset: { 'notification.leaseUntil': 1 },
      });
      console.info(
        JSON.stringify({
          event: 'order_notification_sent',
          orderId: String(order._id),
        }),
      );
    } catch {
      await Order.updateOne(filter, {
        $set: {
          'notification.state':
            order.notification.attempts >= 5 ? 'failed' : 'pending',
          'notification.dueAt': new Date(
            now.getTime() + order.notification.attempts * 60000,
          ),
        },
        $unset: { 'notification.leaseUntil': 1 },
      });
      console.error(
        JSON.stringify({
          event: 'order_notification_failed',
          orderId: String(order._id),
          attempt: order.notification.attempts,
        }),
      );
    }
  }
}
export function startOrderNotifications(send) {
  if (!send) return () => {};
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await deliverOrderNotifications(send);
    } catch {
      console.error(
        JSON.stringify({ event: 'order_notification_worker_failed' }),
      );
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, 30000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
