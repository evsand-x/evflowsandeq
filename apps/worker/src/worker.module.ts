import {
  AdministrationModule,
  FinanceModule,
  HrModule,
  IdentityModule,
  MasterModule,
  ProcurementModule,
  SalesModule,
  WarehouseModule,
} from "@evflow/backend";
import { Module } from "@nestjs/common";
import { FoundationWorker } from "./foundation.worker";

@Module({
  imports: [
    IdentityModule,
    AdministrationModule,
    MasterModule,
    SalesModule,
    WarehouseModule,
    ProcurementModule,
    FinanceModule,
    HrModule,
  ],
  providers: [FoundationWorker],
})
export class WorkerModule {}
