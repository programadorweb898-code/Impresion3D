import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const userSchema = new Schema({ name: {type:String,required:true}, email: {type:String,required:true,unique:true}, passwordHash: {type:String,required:true,select:false} }, {timestamps:true});
export const User = model('User', userSchema);
export const Product = model('Product', new Schema({ name:{type:String,required:true}, description:String, category:String, color:String, priceCents:{type:Number,required:true,min:0}, currency:{type:String,default:'ARS'}, dimensions:{width:Number,height:Number,depth:Number}, active:{type:Boolean,default:true} }, {timestamps:true}));
const orderModel = new Schema({ userId:{type:Schema.Types.ObjectId,ref:'User',required:true}, items:[{productId:{type:Schema.Types.ObjectId,ref:'Product'},name:String,unitPriceCents:Number,quantity:Number,dimensions:{width:Number,height:Number,depth:Number}}], totalCents:{type:Number,required:true},currency:{type:String,required:true},notes:String,status:{type:String,enum:['recibido','en_revision','aprobado','en_fabricacion','terminado','entregado','cancelado'],default:'recibido'},estimatedReadyAt:Date,history:[{status:String,at:Date}] }, {timestamps:true});
orderModel.index({userId:1,createdAt:-1});
export const Order = model('Order',orderModel);
