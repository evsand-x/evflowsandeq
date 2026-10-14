import type { AuthPrincipal } from "@evflow/contracts";
import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  auth: AuthPrincipal & { session_id: string };
  auth_source: "cookie" | "bearer";
}
