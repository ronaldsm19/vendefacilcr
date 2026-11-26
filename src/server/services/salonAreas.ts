import mongoose from "mongoose";
import { TableArea } from "@/models/TableArea";

/** El área a la que se asigna una mesa o pared tiene que ser del mismo negocio. */
export async function isOwnArea(tenantId: string, areaId: unknown): Promise<boolean> {
  if (typeof areaId !== "string" || !mongoose.Types.ObjectId.isValid(areaId)) return false;
  return !!(await TableArea.exists({ _id: areaId, tenantId }));
}
