import { NextResponse } from "next/server";
import { ServiceError } from "@/server/errors";

/** Traduce un ServiceError a la respuesta JSON de siempre ({ error }); cualquier otro error se relanza (500). */
export function serviceErrorResponse(err: unknown): NextResponse {
  if (err instanceof ServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
