import mongoose, { Schema } from "mongoose";

export interface ITenantTheme {
  primaryColor: string;   // e.g. "#FF6B9D"
  secondaryColor: string; // e.g. "#FF8C42"
  accentColor: string;    // e.g. "#FFD166"
}

export interface ITenant {
  _id: string;
  slug: string;
  name: string;
  email: string;
  whatsappNumber: string;
  logoUrl: string;
  description: string;
  plan: "emprende" | "pro" | "premium";
  status: "active" | "inactive" | "suspended";
  theme: ITenantTheme;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema(
  {
    slug:            { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:            { type: String, required: true, trim: true },
    email:           { type: String, required: true, trim: true, lowercase: true },
    whatsappNumber:  { type: String, required: true, trim: true },
    logoUrl:         { type: String, default: "" },
    description:     { type: String, default: "" },
    plan:            { type: String, enum: ["emprende", "pro", "premium"], default: "emprende" },
    status:          { type: String, enum: ["active", "inactive", "suspended"], default: "active" },
    theme: {
      primaryColor:   { type: String, default: "#FF6B9D" },
      secondaryColor: { type: String, default: "#FF8C42" },
      accentColor:    { type: String, default: "#FFD166" },
    },
  },
  { timestamps: true }
);

export const Tenant =
  mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);
