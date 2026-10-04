import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, requireRole } from "@/lib/auth";
import { requirePremium } from "@/lib/plan";
import { Comanda, COMANDA_OPEN_STATUSES, type IComanda } from "@/models/Comanda";
import { startOfTodayCR } from "@/lib/crDate";

/**
 * Cuántas comandas quedan sin cobrar, para el contador del menú y el aviso del punto de venta.
 *
 * Alcance por rol: el mesero ve solo las suyas —es lo que le sirve para no irse con una mesa sin
 * cobrar—, mientras que el admin y la caja ven las de todos, porque son quienes cobran y quienes
 * tienen que saber qué mesa quedó colgando de quién. Por eso `byWaiter` solo viaja para ellos.
 *
 * Es una consulta de conteo que la pantalla repite cada medio minuto: devuelve números, no las
 * comandas, y no toca nada.
 */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const deniedRole = requireRole(session, "admin", "cajero", "mesero");
  if (deniedRole) return deniedRole;
  await connectToDatabase();
  const deniedPlan = await requirePremium(session.tenantId);
  if (deniedPlan) return deniedPlan;

  const onlyMine = session.role === "mesero";

  const comandas = await Comanda.find({
    tenantId: session.tenantId,
    status: { $in: COMANDA_OPEN_STATUSES },
    ...(onlyMine ? { waiterId: session.userId } : {}),
  })
    .select("waiterId waiterName tableId sentAt")
    .lean() as Pick<IComanda, "waiterId" | "waiterName" | "tableId" | "sentAt">[];

  const now = Date.now();
  const todayStart = startOfTodayCR().getTime();

  const tables = new Set<string>();
  const byWaiter = new Map<string, { waiterId: string; waiterName: string; count: number; oldestSentAt: Date }>();
  let mine = 0;
  let fromPreviousDays = 0;
  let oldestSentAt: Date | null = null;

  for (const c of comandas) {
    tables.add(String(c.tableId));
    const sentAt = new Date(c.sentAt);
    if (!oldestSentAt || sentAt < oldestSentAt) oldestSentAt = sentAt;
    if (sentAt.getTime() < todayStart) fromPreviousDays++;
    if (String(c.waiterId) === session.userId) mine++;

    const key = String(c.waiterId);
    const entry = byWaiter.get(key);
    if (!entry) {
      byWaiter.set(key, { waiterId: key, waiterName: c.waiterName, count: 1, oldestSentAt: sentAt });
    } else {
      entry.count++;
      if (sentAt < entry.oldestSentAt) entry.oldestSentAt = sentAt;
    }
  }

  const minutesSince = (d: Date) => Math.floor((now - d.getTime()) / 60000);

  return NextResponse.json({
    scope: onlyMine ? "mine" : "all",
    total: comandas.length,
    mine,
    tables: tables.size,
    fromPreviousDays,
    oldestMinutes: oldestSentAt ? minutesSince(oldestSentAt) : null,
    // El mesero ya sabe que todas son suyas; mandarle el desglose sería decirle cuánto lleva
    // pendiente cada compañera, que no es asunto de su pantalla.
    byWaiter: onlyMine
      ? []
      : Array.from(byWaiter.values())
          .map((w) => ({
            waiterId: w.waiterId,
            waiterName: w.waiterName,
            count: w.count,
            oldestMinutes: minutesSince(w.oldestSentAt),
          }))
          .sort((a, b) => b.oldestMinutes - a.oldestMinutes),
  });
}
