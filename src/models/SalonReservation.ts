import mongoose, { Schema } from "mongoose";

export interface ISalonReservation {
  _id: string;
  tenantId: string;
  tableId: string;
  customerName: string;
  partySize: number;
  dateTime: Date;
  phone: string;
  notes: string;
  status: "confirmed" | "cancelled" | "seated";
}

const SalonReservationSchema = new Schema(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    tableId:      { type: Schema.Types.ObjectId, ref: "SalonTable", required: true },
    customerName: { type: String, required: true },
    partySize:    { type: Number, default: 1 },
    dateTime:     { type: Date, required: true },
    phone:        { type: String, default: "" },
    notes:        { type: String, default: "" },
    status:       { type: String, enum: ["confirmed", "cancelled", "seated"], default: "confirmed" },
  },
  { timestamps: true }
);

SalonReservationSchema.index({ tenantId: 1, dateTime: -1 });

export const SalonReservation =
  mongoose.models.SalonReservation ||
  mongoose.model<ISalonReservation>("SalonReservation", SalonReservationSchema);
