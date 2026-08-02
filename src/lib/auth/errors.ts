import "server-only";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export type AccountErrorCode =
  | "EMAIL_ALREADY_EXISTS"
  | "INVALID_CREDENTIALS"
  | "DATABASE_UNAVAILABLE"
  | "VALIDATION_ERROR";

export function accountError(code: AccountErrorCode, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status });
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function databaseUnavailableError() {
  return accountError(
    "DATABASE_UNAVAILABLE",
    "Account services are temporarily unavailable. You can continue as Guest or try again later.",
    503,
  );
}
