import { PrismaClient, UserRole } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { normalizeEmail } from "../src/lib/auth/identity";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const administratorEmail = normalizeEmail("ishansalah123@gmail.com");

async function main() {
  const result = await prisma.user.updateMany({
    where: { email: administratorEmail },
    data: { role: UserRole.ADMIN },
  });

  if (result.count !== 1) {
    throw new Error(`No Scholar account exists for ${administratorEmail}. Create the account first, then rerun this script.`);
  }

  console.log(`Granted the ADMIN role to ${administratorEmail}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Admin assignment failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
