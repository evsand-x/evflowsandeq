import "reflect-metadata";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { WarehouseModule } from "../../../packages/backend/src/modules/warehouse.module";

describe("Warehouse module authentication wiring (IAM-01/04)", () => {
  it("boots with its own dependencies and rejects unauthenticated inventory requests", async () => {
    const module = await Test.createTestingModule({ imports: [WarehouseModule] }).compile();
    const app = module.createNestApplication();
    try {
      app.setGlobalPrefix("api/v1");
      await app.init();
      await request(app.getHttpServer()).get("/api/v1/inventory").expect(401);
    } finally {
      await app.close();
    }
  });
});
