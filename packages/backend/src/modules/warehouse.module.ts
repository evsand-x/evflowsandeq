import { Module } from "@nestjs/common";
import { InventoryController } from "../warehouse/inventory.controller";
import { IdentityModule } from "./identity.module";

@Module({ imports: [IdentityModule], controllers: [InventoryController] })
export class WarehouseModule {}
