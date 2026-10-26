import { OperationsController } from "../../packages/backend/src/sales/operations.controller";
import { REQUIRED_PERMISSIONS } from "../../packages/backend/src/identity/permissions.decorator";

it("opens a related invoice with its independent submenu read permission", () => {
  expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, OperationsController.prototype.invoice)).toEqual(["sales_invoice.read"]);
});
