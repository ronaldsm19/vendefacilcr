import mongoose, { Schema } from "mongoose";

// Plain interface for use across the app (API responses, components)
export interface IProduct {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  price: number;
  toppings: string[];
  image: string;
  images: string[];        // imágenes adicionales (carrusel)
  category: string;
  available: boolean;
  featured: boolean;       // destacado en "Más vendidos"
  delivery: boolean;       // si tiene envío disponible
  deliveryNote: string;    // nota de horarios/costo de envío
  offers: { qty: number; price: number }[];  // ofertas por volumen
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
      required: [true, "La descripción es requerida"],
    },
    price: {
      type: Number,
      required: [true, "El precio es requerido"],
      min: [0, "El precio no puede ser negativo"],
    },
    toppings: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
      required: [true, "La imagen es requerida"],
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
