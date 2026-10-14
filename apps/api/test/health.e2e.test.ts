import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { HealthController } from "../src/health/health.controller";
import { HealthService } from "../src/health/health.service";

describe("GET /api/v1/health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            check: () => ({
              status: "ok",
              service: "evflow-api",
              timestamp: new Date().toISOString(),
              dependencies: { database: "up", redis: "up", object_storage: "up" },
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => app.close());

  it("returns the dependency state", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "evflow-api",
      dependencies: { database: "up", redis: "up", object_storage: "up" },
    });
  });
});
