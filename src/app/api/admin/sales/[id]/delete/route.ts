import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Sale, type ISaleComandaClaim, type ISaleItem } from "@/models/Sale";
import { Product } from "@/models/Product";
import { Comanda, type IComandaItem } from "@/models/Comanda";
import { Tenant } from "@/models/Tenant";
import { AccessLog } from "@/models/AccessLog";
import { getSession, requireFeature } from "@/lib/auth";
import { syncTableWithComandas } from "@/lib/tableSync";
import { consumeAttempt, clearAttempts } from "@/server/services/rateLimit";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;

interface SaleLean {
  _id: string;
  tenantId: string;
  ticketNumber: number;
  total: number;
  tableId: string;
  comandaIds: string[];
  comandaClaims: ISaleComandaClaim[];
  items: ISaleItem[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denied = requireFeature(session, "pedidos");
  if (denied) return denied;

  const { id } = await params;
  await connectToDatabase();

  const body = await request.json().catch(() => ({}));
  const { password } = body as { password?: unknown };

  const tenant = await Tenant.findById(session.tenantId)
    .select("saleDeletePasswordHash slug")
    .lean() as { saleDeletePasswordHash?: string; slug?: string } | null;
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });

  if (!tenant.saleDeletePasswordHash) {
    return NextResponse.json(
      { error: "Configurá la contraseña de eliminación en Configuración → Caja antes de poder borrar ventas." },
      { status: 409 }
    );
  }

  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Falta la contraseña" }, { status: 400 });
  }

  const rateKey = `sale-delete:${session.tenantId}:${session.userId}`;
  if (!(await consumeAttempt(rateKey, MAX_ATTEMPTS, WINDOW_MS))) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá unos minutos e intentá de nuevo." },
      { status: 429 }
    );
  }

  const match = await bcrypt.compare(password, tenant.saleDeletePasswordHash);
  if (!match) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 403 });
  }
  await clearAttempts(rateKey);

  const sale = await Sale.findOne({ _id: id, tenantId: session.tenantId }).lean() as SaleLean | null;
  if (!sale) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // (1) Devolver inventario: stock += quantity, sold -= quantity (nunca bajo cero).
  const inventoryOps = (sale.items ?? [])
    .filter((i) => i.productId)
    .map((i) => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(i.productId), tenantId: session.tenantId },
        update: [
          {
            $set: {
              stock: { $add: ["$stock", i.quantity] },
              sold:  { $max: [0, { $subtract: ["$sold", i.quantity] }] },
            },
          },
        ],
      },
    }));

  try {
    if (inventoryOps.length > 0) await Product.bulkWrite(inventoryOps);
  } catch (err) {
    console.error("[sales delete] Error devolviendo inventario:", err);
    return NextResponse.json(
      { error: "No se pudo devolver el inventario. La venta no fue eliminada." },
      { status: 500 }
    );
  }

  // (2) Revertir comandas: restar el paidQty que ESTA venta cobró, sacar el saleId, y si a la
  // comanda le queda algo pendiente, reabrirla (vuelve a "servida" si ya la habían servido, si no
  // a "enviada" — Comanda no guarda aparte cuál era su estado justo antes de "pagada", así que
  // servedAt es la única pista confiable). Ventas anteriores a Fase 7 no tienen comandaClaims (el
  // detalle exacto de qué índice/cantidad cobraron); para esas se usa un best-effort por producto.
  const saleIdStr = String(sale._id);
  const reverted: { comandaId: string; incNeg: Record<string, number> }[] = [];
  let warning: string | undefined;

  if (sale.comandaIds?.length > 0) {
    try {
      const comandas = await Comanda.find({ _id: { $in: sale.comandaIds }, tenantId: session.tenantId }).lean();
      const claimsByComandaId = new Map((sale.comandaClaims ?? []).map((c) => [c.comandaId, c]));

      const remainingByProduct = new Map<string, number>();
      for (const it of sale.items ?? []) {
        if (!it.productId) continue;
        remainingByProduct.set(it.productId, (remainingByProduct.get(it.productId) ?? 0) + it.quantity);
      }

      for (const comanda of comandas) {
        const comandaId = String(comanda._id);
        const claim = claimsByComandaId.get(comandaId);
        const incNeg: Record<string, number> = {};

        if (claim) {
          for (const it of claim.items) incNeg[`items.${it.index}.paidQty`] = -it.qty;
        } else {
          warning = "Esta venta es anterior a esta función: la cantidad exacta cobrada por comanda se estimó por producto, no por ítem.";
          (comanda.items as IComandaItem[]).forEach((ci, idx) => {
            const want = remainingByProduct.get(ci.productId) ?? 0;
            if (want <= 0) return;
            const take = Math.min(want, ci.paidQty);
            if (take <= 0) return;
            incNeg[`items.${idx}.paidQty`] = -take;
            remainingByProduct.set(ci.productId, want - take);
          });
        }

        if (Object.keys(incNeg).length === 0) continue;

        const itemsAfter = (comanda.items as IComandaItem[]).map((ci, idx) => {
          const delta = incNeg[`items.${idx}.paidQty`] ?? 0;
          return { quantity: ci.quantity, paidQty: ci.paidQty + delta };
        });
        const hasPendingAfter = itemsAfter.some((i) => i.quantity - i.paidQty > 0);

        const update: Record<string, unknown> = { $inc: incNeg, $pull: { saleIds: saleIdStr } };
        if (comanda.status === "pagada" && hasPendingAfter) {
          update.$set = { status: comanda.servedAt ? "servida" : "enviada", paidAt: null };
        }

        await Comanda.updateOne({ _id: comanda._id, tenantId: session.tenantId }, update);
        reverted.push({ comandaId, incNeg });
      }
    } catch (err) {
      console.error("[sales delete] Error revirtiendo comandas:", err);
      // Compensar lo ya aplicado: reversión de paidQty y devolución de inventario.
      for (const r of reverted) {
        const pos = Object.fromEntries(Object.entries(r.incNeg).map(([k, v]) => [k, -v]));
        await Comanda.updateOne({ _id: r.comandaId, tenantId: session.tenantId }, { $inc: pos }).catch(() => {});
      }
      const compensateOps = (sale.items ?? [])
        .filter((i) => i.productId)
        .map((i) => ({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(i.productId), tenantId: session.tenantId },
            update: [
              {
                $set: {
                  stock: { $max: [0, { $subtract: ["$stock", i.quantity] }] },
                  sold:  { $add: ["$sold", i.quantity] },
                },
              },
            ],
          },
        }));
      if (compensateOps.length > 0) await Product.bulkWrite(compensateOps).catch(() => {});
      return NextResponse.json(
        { error: "No se pudo revertir la comanda asociada. La venta no fue eliminada." },
        { status: 500 }
      );
    }
  }

  // (3) Recalcular estado de la mesa — mejor esfuerzo, no invalida el borrado (mismo criterio
  // que POST /api/admin/sales al cerrar comandas/mesa tras registrar una venta).
  if (sale.tableId) {
    await syncTableWithComandas(session.tenantId, sale.tableId).catch((err) => {
      console.error("[sales delete] Error sincronizando la mesa:", err);
    });
  }

  // (4) Borrar la venta.
  await Sale.deleteOne({ _id: id, tenantId: session.tenantId });

  AccessLog.create({
    tenantId:   session.tenantId,
    tenantSlug: tenant.slug ?? session.tenantSlug,
    userEmail:  session.email || session.name,
    ip:         request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    userAgent:  request.headers.get("user-agent") ?? "",
    success:    true,
    event:      "sale_delete",
    path:       `saleId=${id};ticketNumber=${sale.ticketNumber};total=${sale.total}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, ...(warning ? { warning } : {}) });
}
