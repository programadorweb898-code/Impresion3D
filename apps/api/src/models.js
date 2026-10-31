import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, select: false },
    authVersion: { type: Number, default: 0, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpiresAt: { type: Date, select: false },
    resetRequestedAt: { type: Date, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  },
  { timestamps: true },
);
userSchema.index({ resetTokenHash: 1 }, { sparse: true });
export const User = model('User', userSchema);
const socialSchema = new Schema(
  {
    provider: { type: String, enum: ['google', 'facebook'], required: true },
    subject: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
socialSchema.index({ provider: 1, subject: 1 }, { unique: true });
export const SocialIdentity = model('SocialIdentity', socialSchema);
export const Product = model(
  'Product',
  new Schema(
    {
      name: { type: String, required: true },
      description: String,
      category: String,
      color: String,
      priceCents: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'ARS' },
      dimensions: { width: Number, height: Number, depth: Number },
      active: { type: Boolean, default: true },
      image: { url: String, publicId: String, width: Number, height: Number },
      model: {
        url: String,
        publicId: String,
        format: { type: String, enum: ['glb', 'stl'] },
        sourceFormat: { type: String, enum: ['3mf'] },
        bytes: Number,
      },
    },
    { timestamps: true },
  ),
);
const orderModel = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        unitPriceCents: Number,
        quantity: Number,
        dimensions: { width: Number, height: Number, depth: Number },
      },
    ],
    requestId: { type: String, select: false },
    requestHash: { type: String, select: false },
    totalCents: { type: Number, required: true },
    currency: { type: String, required: true },
    notes: String,
    status: {
      type: String,
      enum: [
        'recibido',
        'en_revision',
        'aprobado',
        'en_fabricacion',
        'terminado',
        'entregado',
        'cancelado',
      ],
      default: 'recibido',
    },
    estimatedReadyAt: Date,
    history: [{ status: String, at: Date, estimatedReadyAt: Date }],
  },
  { timestamps: true },
);
orderModel.index(
  { userId: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } },
);
orderModel.index({ userId: 1, createdAt: -1 });
orderModel.index({ createdAt: -1 });
export const Order = model('Order', orderModel);
