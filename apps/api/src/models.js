import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String },
    emailVerifiedAt: Date,
    verificationRequired: { type: Boolean, default: false },
    verificationTokenHash: { type: String, select: false },
    verificationExpiresAt: { type: Date, select: false },
    verificationRequestedAt: { type: Date, select: false },
    passwordHash: { type: String, select: false },
    authVersion: { type: Number, default: 0, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpiresAt: { type: Date, select: false },
    resetRequestedAt: { type: Date, select: false },
    pendingEmail: { type: String, select: false },
    emailChangeTokenHash: { type: String, select: false },
    emailChangeExpiresAt: { type: Date, select: false },
    emailChangeRequestedAt: { type: Date, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  },
  { timestamps: true },
);
// Social accounts can exist without an email. Addresses that are present remain unique.
userSchema.index(
  { email: 1 },
  {
    name: 'users_email_unique',
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
  },
);
userSchema.index({ resetTokenHash: 1 }, { sparse: true });
userSchema.index({ verificationTokenHash: 1 }, { sparse: true });
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
const productSchema = new Schema(
  {
    name: { type: String, required: true },
    description: String,
    shortDescription: String,
    category: String,
    categories: { type: [String], default: undefined },
    color: String,
    priceCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'ARS' },
    dimensions: { width: Number, height: Number, depth: Number },
    active: { type: Boolean, default: true },
    historicalSalesCount: { type: Number, default: 0, min: 0 },
    viewsCount: { type: Number, default: 0, min: 0 },
    image: { url: String, publicId: String, width: Number, height: Number },
    gallery: {
      angle: { url: String, publicId: String, width: Number, height: Number },
      context: {
        url: String,
        publicId: String,
        width: Number,
        height: Number,
      },
    },
    model: {
      url: String,
      publicId: String,
      format: { type: String, enum: ['glb', 'stl'] },
      sourceFormat: { type: String, enum: ['3mf'] },
      bytes: Number,
    },
  },
  { timestamps: true },
);
productSchema.index({ active: 1, priceCents: 1, _id: 1 });
productSchema.index({ active: 1, createdAt: -1, _id: -1 });
export const Product = model('Product', productSchema);
const orderOfferSchema = new Schema(
  {
    id: String,
    mode: String,
    selections: [
      new Schema(
        { id: String, name: String, quantity: Number },
        { _id: false },
      ),
    ],
  },
  { _id: false },
);
const orderModel = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        unitPriceCents: Number,
        offer: { type: orderOfferSchema, default: undefined },
        quantity: Number,
        dimensions: { width: Number, height: Number, depth: Number },
      },
    ],
    delivery: {
      type: new Schema(
        {
          method: {
            type: String,
            enum: ['pickup', 'shipping'],
            required: true,
          },
          postalCode: String,
          originPostalCode: String,
          costCents: { type: Number, min: 0 },
          status: { type: String, enum: ['free_pickup', 'pending_quote'] },
        },
        { _id: false },
      ),
      default: undefined,
    },
    requestId: { type: String, select: false },
    requestHash: { type: String, select: false },
    totalCents: { type: Number, required: true },
    currency: { type: String, required: true },
    notes: String,
    notification: {
      state: {
        type: String,
        enum: ['pending', 'processing', 'sent', 'failed'],
        default: 'pending',
        select: false,
      },
      attempts: { type: Number, default: 0, select: false },
      dueAt: { type: Date, default: Date.now, select: false },
      leaseUntil: { type: Date, select: false },
      sentAt: { type: Date, select: false },
    },
    status: {
      type: String,
      enum: ['en_espera', 'en_preparacion', 'finalizado', 'cancelado'],
      default: 'en_espera',
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
orderModel.index({ userId: 1, createdAt: -1, _id: -1 });
orderModel.index({ 'items.productId': 1 });
orderModel.index({ createdAt: -1 });
orderModel.index({ 'notification.state': 1, 'notification.dueAt': 1 });
orderModel.index({ 'notification.state': 1, 'notification.leaseUntil': 1 });
export const Order = model('Order', orderModel);

const designRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileId: { type: Schema.Types.ObjectId, required: true },
    filename: String,
    format: String,
    requestId: { type: String, required: true },
    requestHash: { type: String, required: true, select: false },
    quantity: Number,
    scale: Number,
    dimensions: { width: Number, height: Number, depth: Number },
    colorStatus: { type: String, enum: ['complete', 'missing', 'unknown'] },
    acceptedMissingColor: Boolean,
    usage: String,
    status: {
      type: String,
      enum: ['recibido', 'en_revision', 'presupuestado', 'cerrado'],
      default: 'recibido',
    },
    priceCents: { type: Number, default: null },
    response: { type: String, default: '' },
  },
  { timestamps: true },
);
designRequestSchema.index({ userId: 1, requestId: 1 }, { unique: true });
designRequestSchema.index({ userId: 1, createdAt: -1 });
designRequestSchema.index({ createdAt: -1 });
export const DesignRequest = model('DesignRequest', designRequestSchema);

const slicerWorkerSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authVersion: { type: Number, default: 0 },
    name: { type: String, default: 'Mi PC' },
    tokenHash: { type: String, select: false },
    pairingHash: { type: String, select: false },
    pairingExpiresAt: Date,
    revokedAt: Date,
    lastSeenAt: Date,
    profiles: [{ _id: false, id: String, name: String, material: String }],
  },
  { timestamps: true },
);
slicerWorkerSchema.index({ tokenHash: 1 }, { unique: true, sparse: true });
slicerWorkerSchema.index({ pairingHash: 1 }, { unique: true, sparse: true });
export const SlicerWorker = model('SlicerWorker', slicerWorkerSchema);
const slicingJobSchema = new Schema(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'DesignRequest',
      required: true,
    },
    workerId: {
      type: Schema.Types.ObjectId,
      ref: 'SlicerWorker',
      required: true,
    },
    profileId: String,
    profileName: String,
    material: String,
    state: {
      type: String,
      enum: ['queued', 'processing', 'complete', 'failed'],
      default: 'queued',
    },
    leaseHash: { type: String, select: false },
    leaseUntil: Date,
    attempts: { type: Number, default: 0 },
    result: { grams: Number, seconds: Number, plates: Number },
    error: String,
    finishedAt: Date,
  },
  { timestamps: true },
);
slicingJobSchema.index({ requestId: 1 }, { unique: true });
slicingJobSchema.index({ workerId: 1, state: 1, leaseUntil: 1 });
export const SlicingJob = model('SlicingJob', slicingJobSchema);
