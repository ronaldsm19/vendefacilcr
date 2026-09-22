import mongoose, { Schema } from "mongoose";

export interface IRateLimit {
  _id: string;
  key: string;
  count: number;
  resetAt: Date;
}

const RateLimitSchema = new Schema({
  key:     { type: String, required: true, unique: true },
  count:   { type: Number, required: true, default: 0 },
  resetAt: { type: Date, required: true },
});

// TTL: Mongo borra el documento cuando pasa resetAt. El barrido corre cada ~60 s, así que las
// lecturas igual comparan resetAt contra la hora actual en vez de confiar en que ya no exista.
RateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);
