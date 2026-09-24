import mongoose, { Schema } from "mongoose";
import { MAX_EXTRA_NAME, type LineExtra } from "@/lib/pricing";

export type ProductExtra = LineExtra;

// Plain interface for use across the app (API responses, components)
export interface IProduct {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  /** @deprecated Obsoleto: reemplazado por `extras`. Solo lo lee la migración única (src/server/services/productExtras.ts). */
  toppings?: string[];
  /** Extras con precio que el cliente puede sumarle al producto. */
  extras: ProductExtra[];
  image: string;
  images: string[];        // imágenes adicionales (carrusel)
  category: string;
  available: boolean;
  featured: boolean;       // destacado en "Más vendidos"
  delivery: boolean;       // si tiene envío disponible
  deliveryNote: string;    // nota de horarios/costo de envío
  offers: { qty: number; price: number }[];  // ofertas por volumen
  menuSection: "panaderia" | "bebidas" | "";
  station: "cocina" | "bebidas" | "ninguna";
  stock: number;
  sold: number;            // unidades vendidas acumuladas
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    name: {
      type: String,
      required: [true, "El nombre es requerido"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: [true, "El precio es requerido"],
      min: [0, "El precio no puede ser negativo"],
    },
    cost: {
      type: Number,
      default: 0,
      min: [0, "El costo no puede ser negativo"],
    },
    // OBSOLETO: reemplazado por `extras`. Se conserva para no perder los datos viejos; ninguna
    // pantalla lo lee. La migración única copia cada topping como extra de ₡0.
    toppings: {
      type: [String],
      default: undefined,
    },
    extras: {
      type: [{
        name:  { type: String, required: true, trim: true, maxlength: MAX_EXTRA_NAME },
        price: { type: Number, required: true, min: [0, "El precio del extra no puede ser negativo"] },
        _id: false,
      }],
      default: [],
    },
    image: {
      type: String,
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      required: [true, "La categoría es requerida"],
      trim: true,
    },
    menuSection: {
      type: String,
      enum: ["panaderia", "bebidas", ""],
      default: "panaderia",
    },
    station: {
      type: String,
      enum: ["cocina", "bebidas", "ninguna"],
      default: "cocina",
    },
    available: {
      type: Boolean,
      default: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    delivery: {
      type: Boolean,
      default: false,
    },
    deliveryNote: {
      type: String,
      default: "",
    },
    offers: {
      type: [{ qty: { type: Number, required: true }, price: { type: Number, required: true } }],
      default: [],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, "El stock no puede ser negativo"],
    },
    sold: {
      type: Number,
      default: 0,
      min: [0, "Las unidades vendidas no pueden ser negativas"],
    },
  },
  { timestamps: true }
);

export const Product =
  mongoose.models.Product || mongoose.model("Product", ProductSchema);
