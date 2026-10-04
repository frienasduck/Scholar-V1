import "server-only";
import type { Prisma } from "@prisma/client";

// Setup imports keep their existing separate bonus allocation. Count standard
// books directly, so clients cannot release their quota via a file-ledger ID.
export async function privateStorageUsed(tx: Prisma.TransactionClient, userId: string) {
  const [files, books] = await Promise.all([
    tx.storedFile.aggregate({ where: { userId, deletedAt: null }, _sum: { sizeBytes: true } }),
    tx.customEbook.aggregate({ where: { userId, deletedAt: null, allocation: "standard" }, _sum: { sizeBytes: true } }),
  ]);
  return (files._sum.sizeBytes ?? 0) + (books._sum.sizeBytes ?? 0);
}
