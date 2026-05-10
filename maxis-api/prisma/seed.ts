import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const { DEMO_CATALOG_ITEMS, DEMO_MERCHANT } = await import(
    new URL("../../shared/maxis-demo-data.ts", import.meta.url).href,
  );

  const passwordHash = await bcrypt.hash(DEMO_MERCHANT.passwordPlainForDemo, 12);

  const merchant = await prisma.merchant.upsert({
    where: { slug: DEMO_MERCHANT.slug },
    update: {
      passwordHash,
      name: DEMO_MERCHANT.name,
      city: DEMO_MERCHANT.city,
      email: DEMO_MERCHANT.email,
      payoutWallet: DEMO_MERCHANT.payoutWallet,
    },
    create: {
      name: DEMO_MERCHANT.name,
      slug: DEMO_MERCHANT.slug,
      city: DEMO_MERCHANT.city,
      email: DEMO_MERCHANT.email,
      passwordHash,
      payoutWallet: DEMO_MERCHANT.payoutWallet,
    },
  });

  for (const row of DEMO_CATALOG_ITEMS) {
    await prisma.catalogItem.upsert({
      where: { id: row.id },
      update: {
        name: row.name,
        priceUsd: row.priceUsd,
        available: row.available,
        merchantId: merchant.id,
      },
      create: {
        id: row.id,
        merchantId: merchant.id,
        name: row.name,
        priceUsd: row.priceUsd,
        available: row.available,
      },
    });
  }

  console.log(`Seed OK — merchant slug=${merchant.slug} (from shared/maxis-demo-data.ts)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
