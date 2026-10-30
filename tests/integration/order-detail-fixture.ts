import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@evflow/database";

export async function detailFixture(run: (f: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database required");
  const rollback = new Error("rollback detail fixture");
  await prisma
    .$transaction(
      async (tx) => {
        await run(await setup(tx));
        throw rollback;
      },
      { timeout: 30000 },
    )
    .catch((e) => {
      if (e !== rollback) throw e;
    });
}
async function setup(tx: Prisma.TransactionClient) {
  const c = (await tx.company.create({ data: { name: "Detail integration fixture" } })).id;
  const a = (
    await tx.user.create({
      data: {
        email: `${randomUUID()}@test.invalid`,
        displayName: "Detail actor",
        passwordHash: "disabled",
      },
    })
  ).id;
  await tx.companyMembership.create({ data: { companyId: c, userId: a } });
  const master = () => ({
    companyId: c,
    code: randomUUID(),
    name: randomUUID(),
    normalizedName: randomUUID(),
    state: "ACTIVE" as const,
    createdById: a,
    updatedById: a,
  });
  const channel = await tx.customerChannel.create({ data: master() });
  const customer = await tx.customer.create({ data: { ...master(), channelId: channel.id } });
  const warehouse = await tx.warehouse.create({ data: { ...master(), timezone: "Asia/Makassar" } });
  const uom = await tx.uom.create({ data: master() });
  const category = await tx.productCategory.create({ data: master() });
  const product = await tx.product.create({
    data: { ...master(), categoryId: category.id, baseUomId: uom.id },
  });
  const order = await tx.salesOrder.create({
    data: {
      companyId: c,
      customerId: customer.id,
      createdById: a,
      number: "SO.02",
      warehouseId: warehouse.id,
      state: "OPEN",
      orderDate: new Date("2026-10-20"),
      lines: {
        create: {
          companyId: c,
          productId: product.id,
          orderedQuantity: "10",
          allocatedQuantity: "10",
          unitPrice: "100",
          uomId: uom.id,
        },
      },
    },
    include: { lines: true },
  });
  const batch = await tx.fulfillmentBatch.create({
    data: { companyId: c, salesOrderId: order.id, number: "B.01" },
  });
  return { tx, c, a, customer, warehouse, product, uom, order, batch };
}
