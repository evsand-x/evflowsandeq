import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type { HealthResponse } from "@evflow/contracts";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    const health = await this.healthService.check();
    if (health.status === "degraded") {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }
}
