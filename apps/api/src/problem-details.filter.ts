import { randomUUID } from "node:crypto";
import { companySelectionRequiredSchema } from "@evflow/contracts";
import type { ArgumentsHost } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, type ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const validation = exception instanceof Error && exception.name === "ZodError";
    const status =
      exception instanceof HttpException ? exception.getStatus() : validation ? 400 : 500;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const detail =
      typeof payload === "string"
        ? payload
        : payload && typeof payload === "object" && "message" in payload
          ? Array.isArray(payload.message)
            ? payload.message.join("; ")
            : String(payload.message)
          : validation
            ? "Format atau isian permintaan tidak valid."
            : status === 500
              ? "Terjadi kesalahan internal."
              : "Permintaan tidak dapat diproses.";
    const code = HttpStatus[status] ?? "ERROR";
    const selection =
      status === HttpStatus.CONFLICT
        ? companySelectionRequiredSchema.safeParse(payload)
        : undefined;
    response
      .status(status)
      .type("application/problem+json")
      .send({
        type: `urn:evflow:problem:${String(code).toLowerCase().replaceAll("_", "-")}`,
        title: code,
        status,
        code: selection?.success ? selection.data.code : code,
        detail,
        request_id: randomUUID(),
        ...(payload && typeof payload === "object" && "settings_href" in payload &&
          typeof payload.settings_href === "string" && /^\/setting\/[a-z-]+$/.test(payload.settings_href)
          ? { settings_href: payload.settings_href } : {}),
        ...(selection?.success
          ? { companies: selection.data.companies }
          : payload && typeof payload === "object"
            ? { errors: payload }
            : {}),
      });
  }
}
