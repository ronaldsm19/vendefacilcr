import mongoose, { Schema } from "mongoose";

export interface IUser {
  _id: string;
  email: string;
  password: string; // bcrypt hash
  role: "admin" | "superadmin";
  tenantId?: string;
  createdAt: Date;
}

const UserSchema = new Schema(
  {
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ["admin", "superadmin"], default: "admin" },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false },
  },
  { timestamps: true }
);

export const User =
  mongoose.models.User || mongoose.model("User", UserSchema);
