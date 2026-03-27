import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Tenant } from "@/models/Tenant";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
import { Expense } from "@/models/Expense";
import { Category } from "@/models/Category";
import { SiteSettings } from "@/models/SiteSettings";
import { ProductClick } from "@/models/ProductClick";

// POST /api/admin/setup
// Crea el tenant dulcepecado, el usuario admin y migra documentos huérfanos.
// Seguro de ejecutar múltiples veces (idempotente).
export async function POST() {
  try {
    await connectToDatabase();

    // ── 1. Create or find the dulcepecado tenant ────────────────
    let tenant = await Tenant.findOne({ slug: "dulcepecado" });
    if (!tenant) {
      tenant = await Tenant.create({
        slug: "dulcepecado",
        name: "Dulce Pecado",
        email: "dulcepecado@gmail.com",
        whatsappNumber: "50661266865",
        logoUrl: "/logo.png",
        description: "Postres y dulces artesanales hechos con amor en Turrialba, Costa Rica.",
        plan: "pro",
        status: "active",
        theme: {
          primaryColor: "#FF6B9D",
          secondaryColor: "#FF8C42",
          accentColor: "#FFD166",
        },
      });
    }

    const tenantId: mongoose.Types.ObjectId = tenant._id as mongoose.Types.ObjectId;

    // ── 2. Create or update the admin user ─────────────────────
    const email = "dulcepecado@gmail.com";
    const password = "DulcePecado2025!";

    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      const hash = await bcrypt.hash(password, 12);
      await User.create({ email, password: hash, role: "admin", tenantId });
    } else if (!existingUser.tenantId) {
      await User.updateOne({ email }, { $set: { tenantId } });
    }

    // ── 3. Migrate orphan documents → assign to dulcepecado ────
    const filter = { tenantId: { $exists: false } };
    const update = { $set: { tenantId } };

    const [products, orders, expenses, categories, settings, clicks] = await Promise.all([
      Product.updateMany(filter, update),
      Order.updateMany(filter, update),
      Expense.updateMany(filter, update),
      Category.updateMany(filter, update),
      SiteSettings.updateMany(filter, update),
      ProductClick.updateMany(filter, update),
    ]);

    return NextResponse.json({
      ok: true,
      tenantId: tenantId.toString(),
      migrated: {
        products: products.modifiedCount,
        orders: orders.modifiedCount,
        expenses: expenses.modifiedCount,
        categories: categories.modifiedCount,
        settings: settings.modifiedCount,
        clicks: clicks.modifiedCount,
      },
    });
  } catch (error) {
    console.error("[POST /api/admin/setup]", error);
    return NextResponse.json({ error: "Error durante el setup" }, { status: 500 });
  }
}
