import mongoose, { Schema } from "mongoose";

export interface IOrderItem {
  productId:    string;
  productName:  string;
  price:        number;       // precio unitario al momento del pedido
  quantity:     number;
  itemToppings: string[][];   // toppings por unidad (índice = nro de unidad)
  subtotal:     number;
}

export interface IOrder {
  _id:          string;
  tenantId:     string;
  customerName: string;
  phone:        string;
  // Nuevo formato (multi-producto)
  items:        IOrderItem[];
  total:        number;
  paid:         boolean;
  orderedAt:    Date;
  notes?:       string;
  // Campos legacy (órdenes anteriores con un solo producto)
  productId?:   string;
  productName?: string;
  options?:     string[];
  quantity?:    number;
  createdAt:    Date;
  updatedAt:    Date;
}

const OrderItemSchema = new Schema({
  productId:    { type: String, required: true },
  productName:  { type: String, required: true },
  price:        { type: Number, required: true },
  quantity:     { type: Number, required: true, min: 1 },
  itemToppings: { type: [[String]], default: [] },
  subtotal:     { type: Number, required: true },
}, { _id: false });

const OrderSchema = new Schema(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    customerName: { type: String, required: true, trim: true },
    phone:        { type: String, required: true, trim: true },
    items:        { type: [OrderItemSchema], default: [] },
    total:        { type: Number, required: true, min: 0 },
    paid:         { type: Boolean, default: false },
    orderedAt:    { type: Date, default: Date.now },
    notes:        { type: String },
    // Legacy
    productId:    { type: String },
    productName:  { type: String },
    options:      { type: [String], default: [] },
    quantity:     { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const Order =
  mongoose.models.Order || mongoose.model("Order", OrderSchema);
