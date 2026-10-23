import { RequireResourcePermission } from "../identity/resource-permissions";
import { customerPage, customerDetail, customerHistory, customerSales } from "./customer-workspace";
import {
  listResourceSchema,
  masterDetail,
  masterDuplicates,
  masterHistory,
  masterPage,
  workspaceResourceSchema,
} from "./master-workspace";
import {
  activateMasterSchema,
  createCustomerSchema,
  updateCustomerSchema,
  createLocatorSchema,
  createOperationalItemSchema,
  createProductSchema,
  updateProductSchema,
  createProductRegistrationSchema,
  verifyProductRegistrationSchema,
  createProductReferencePriceSchema,
  createProductUomSchema,
  createRayonSchema,
  createReferenceMasterSchema,
  createSupplierSchema,
  updateSupplierSchema,
  createVendorSchema,
  createWarehouseSchema,
  updateLocatorSchema,
  updateOperationalItemSchema,
  updateRayonSchema,
  updateReferenceMasterSchema,
  updateVendorSchema,
  updateWarehouseSchema,
  masterResourceSchema,
} from "@evflow/contracts";
import { Prisma, prisma } from "@evflow/database";
import { z } from "zod";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../identity/auth.types";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import { MasterService } from "./master.service";

@Controller()
@UseGuards(AuthGuard, PermissionGuard)
export class MasterController {
  constructor(@Inject(MasterService) private readonly master: MasterService) {}

  @Get("master-data/customer-options")
  @RequirePermissions("master_customer.read")
  async customerOptions(@Req() req: AuthenticatedRequest) {
    const where = { companyId: req.auth.company_id, state: "ACTIVE" as const };
    const select = { id: true, name: true };
    const [channels, rayons] = await Promise.all([
      prisma.customerChannel.findMany({ where, select, orderBy: { name: "asc" } }),
      prisma.rayon.findMany({ where, select, orderBy: { name: "asc" } }),
    ]);
    return { data: { channels, rayons } };
  }

  @Post("crm/master/customers")
  @RequirePermissions("crm_customer.create")
  async createCrmCustomer(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const input = createCustomerSchema.parse(body);
    const created = await this.master.createCustomer(req.auth.company_id, req.auth.user_id, input);
    return { data: { id: created.id, code: created.code, name: created.name } };
  }

  @Get("master-data/:resource")
  @RequireResourcePermission("master", "read")
  async list(
    @Param("resource") resource: string,
    @Query("q") search: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const parsed = masterResourceSchema.safeParse(resource);
    if (!parsed.success) throw new BadRequestException("Jenis master tidak tersedia.");
    const reference = ["product-categories", "uoms", "customer-channels", "rayons"].includes(
      resource,
    );
    return {
      data: reference
        ? await this.master.listReference(req.auth.company_id, resource, search)
        : await this.master.listMasters(req.auth.company_id, resource, search),
    };
  }

  @Post("master-data/:resource")
  @RequireResourcePermission("master", "create")
  async create(
    @Param("resource") resource: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = parseCreate(resource, body);
    if (!result) throw new BadRequestException("Data master tidak valid.");
    const data = result.schema.parse(body);
    const created =
      resource === "product-categories" ||
      resource === "uoms" ||
      resource === "customer-channels" ||
      resource === "rayons"
        ? await this.master.createReference(
            req.auth.company_id,
            req.auth.user_id,
            resource,
            data as { code: string; name: string; coverage_notes?: string | null },
          )
        : resource === "products"
          ? await this.master.createProduct(req.auth.company_id, req.auth.user_id, data)
          : resource === "customers"
            ? await this.master.createCustomer(req.auth.company_id, req.auth.user_id, data)
            : resource === "suppliers"
              ? await this.master.createSupplier(req.auth.company_id, req.auth.user_id, data)
              : resource === "vendors"
                ? await this.master.createVendor(req.auth.company_id, req.auth.user_id, data)
                : resource === "warehouses"
                  ? await this.master.createWarehouse(req.auth.company_id, req.auth.user_id, data)
                  : resource === "locators"
                    ? await this.master.createLocator(req.auth.company_id, req.auth.user_id, data)
                    : await this.master.createOperationalItem(
                        req.auth.company_id,
                        req.auth.user_id,
                        data,
                      );
    return { data: serialize(created) };
  }

  @Get("master-data/workspace/:resource")
  @RequireResourcePermission("master", "read")
  async workspaceList(
    @Param("resource") resource: string,
    @Query() query: Record<string, string>,
    @Req() req: AuthenticatedRequest,
  ) {
    return serialize(
      await masterPage(req.auth.company_id, listResourceSchema.parse(resource), query),
    );
  }

  @Get("master-data/workspace/:resource/:id")
  @RequireResourcePermission("master", "read")
  async workspaceDetail(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      data: serialize(
        await masterDetail(
          req.auth.company_id,
          workspaceResourceSchema.parse(resource),
          z.string().uuid().parse(id),
        ),
      ),
    };
  }

  @Post("master-data/workspace/:resource/duplicate-check")
  @RequireResourcePermission("master", "read")
  async workspaceDuplicates(
    @Param("resource") resource: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      data: await masterDuplicates(
        req.auth.company_id,
        workspaceResourceSchema.parse(resource),
        body,
      ),
    };
  }

  @Get("master-data/workspace/:resource/:id/history")
  @RequireResourcePermission("master", "read")
  async workspaceHistory(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      data: serialize(
        await masterHistory(
          req.auth.company_id,
          workspaceResourceSchema.parse(resource),
          z.string().uuid().parse(id),
        ),
      ),
    };
  }

  @Get("master-data/customer-workspace/list")
  @RequirePermissions("master_customer.read")
  async customerList(@Query() query: unknown, @Req() req: AuthenticatedRequest) {
    return serialize(await customerPage(req.auth, query));
  }

  @Get("master-data/customers/:id")
  @RequirePermissions("master_customer.read")
  async customerDetail(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: serialize(await customerDetail(req.auth, z.string().uuid().parse(id))) };
  }

  @Get("master-data/customers/:id/history")
  @RequirePermissions("master_customer.read")
  async customerHistory(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: serialize(await customerHistory(req.auth, z.string().uuid().parse(id))) };
  }

  @Get("master-data/customers/:id/sales")
  @RequirePermissions("master_customer.read")
  async customerSales(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: serialize(await customerSales(req.auth, z.string().uuid().parse(id))) };
  }

  @Post("master-data/customers/:id/archive")
  @RequirePermissions("master_customer.activate")
  async archiveCustomer(
    @Param("id") id: string,
    @Headers("if-match") match: string | undefined,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = z
      .object({ reason: z.string().trim().min(3).max(1000) })
      .strict()
      .parse(body);
    return {
      data: serialize(
        await this.master.changeState(
          req.auth.company_id,
          req.auth.user_id,
          "customers",
          z.string().uuid().parse(id),
          parseVersion(match),
          "ARCHIVED",
          input.reason,
        ),
      ),
    };
  }

  @Patch("master-data/customers/:id")
  @RequirePermissions("master_customer.update")
  async updateCustomer(
    @Param("id") id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const expectedVersion = parseVersion(ifMatch);
    const input = updateCustomerSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.master.updateCustomer(
          req.auth.company_id,
          req.auth.user_id,
          id,
          expectedVersion,
          input.data,
        ),
      ),
    };
  }

  @Patch("master-data/suppliers/:id")
  @RequirePermissions("master_supplier.update")
  async updateSupplier(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = updateSupplierSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.master.updateSupplier(req.auth.company_id, req.auth.user_id, id, input.data),
      ),
    };
  }

  @Patch("master-data/:resource/:id")
  @RequireResourcePermission("master", "update")
  async updateSimple(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const schemas = {
      vendors: updateVendorSchema,
      warehouses: updateWarehouseSchema,
      locators: updateLocatorSchema,
      "operational-items": updateOperationalItemSchema,
      "product-categories": updateReferenceMasterSchema,
      uoms: updateReferenceMasterSchema,
      "customer-channels": updateReferenceMasterSchema,
      rayons: updateRayonSchema,
    } as const;
    if (!Object.hasOwn(schemas, resource))
      throw new BadRequestException("Jenis master tidak dapat diubah melalui endpoint ini.");
    const kind = resource as keyof typeof schemas;
    const input = schemas[kind].safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.master.updateSimpleMaster(
          req.auth.company_id,
          req.auth.user_id,
          kind,
          z.string().uuid().parse(id),
          input.data,
        ),
      ),
    };
  }

  @Post("master-data/:resource/:id/activate")
  @RequireResourcePermission("master", "activate")
  async activate(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const expectedVersion = parseVersion(ifMatch);
    const input = activateMasterSchema.safeParse(body ?? {});
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.master.changeState(
        req.auth.company_id,
        req.auth.user_id,
        resource,
        id,
        expectedVersion,
        "ACTIVE",
        input.data.reason,
      ),
    };
  }

  @Post("master-data/products/:id/uoms")
  @RequirePermissions("master_product.update")
  async addProductUom(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = createProductUomSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.master.addProductUom(req.auth.company_id, req.auth.user_id, id, input.data),
      ),
    };
  }

  @Get("master-data/products/:id")
  @RequirePermissions("master_product.read")
  async product(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: serialize(await this.master.getProduct(req.auth.company_id, id)) };
  }

  @Patch("master-data/products/:id")
  @RequirePermissions("master_product.update")
  async updateProduct(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = updateProductSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.master.updateProduct(req.auth.company_id, req.auth.user_id, id, input.data),
      ),
    };
  }

  @Post("master-data/products/duplicate-check")
  @RequirePermissions("master_product.read")
  async productDuplicateCheck(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const input = z
      .object({
        name: z.string().trim().min(1).max(200),
        code: z.string().trim().max(50).optional(),
      })
      .strict()
      .safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(await this.master.productDuplicateCheck(req.auth.company_id, input.data)),
    };
  }

  @Get("master-data/products/:id/history")
  @RequirePermissions("master_product.read")
  async productHistory(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return { data: serialize(await this.master.productHistory(req.auth.company_id, id)) };
  }

  @Post("master-data/products/:id/registrations")
  @RequirePermissions("master_product.update")
  async productRegistration(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = createProductRegistrationSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.master.addProductRegistration(
          req.auth.company_id,
          req.auth.user_id,
          id,
          input.data,
        ),
      ),
    };
  }

  @Post("master-data/product-registrations/:id/verify")
  @RequirePermissions("master_product.activate")
  async verifyProductRegistration(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = verifyProductRegistrationSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.master.verifyProductRegistration(
          req.auth.company_id,
          req.auth.user_id,
          id,
          input.data,
        ),
      ),
    };
  }

  @Post("master-data/products/:id/reference-prices")
  @RequirePermissions("master_product.update")
  async productReferencePrice(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = createProductReferencePriceSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: serialize(
        await this.master.addProductReferencePrice(
          req.auth.company_id,
          req.auth.user_id,
          id,
          input.data,
        ),
      ),
    };
  }

  @Post("master-data/:resource/:id/deactivate")
  @RequireResourcePermission("master", "update")
  async deactivate(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const expectedVersion = parseVersion(ifMatch);
    const input = activateMasterSchema.safeParse(body ?? {});
    if (!input.success) throw new BadRequestException(input.error.flatten());
    return {
      data: await this.master.changeState(
        req.auth.company_id,
        req.auth.user_id,
        resource,
        id,
        expectedVersion,
        "INACTIVE",
        input.data.reason,
      ),
    };
  }
}

function parseCreate(resource: string, body: unknown) {
  switch (resource) {
    case "product-categories":
    case "uoms":
    case "customer-channels":
      return { schema: createReferenceMasterSchema };
    case "rayons":
      return { schema: createRayonSchema };
    case "products":
      return { schema: createProductSchema };
    case "customers":
      return { schema: createCustomerSchema };
    case "suppliers":
      return { schema: createSupplierSchema };
    case "vendors":
      return { schema: createVendorSchema };
    case "warehouses":
      return { schema: createWarehouseSchema };
    case "locators":
      return { schema: createLocatorSchema };
    case "operational-items":
      return { schema: createOperationalItemSchema };
    default:
      void body;
      return null;
  }
}

function parseVersion(value: string | undefined) {
  const normalized = value?.replace(/^W\//, "").replaceAll('"', "");
  const version = normalized ? Number.parseInt(normalized, 10) : Number.NaN;
  if (!Number.isInteger(version) || version < 1)
    throw new BadRequestException('Header If-Match wajib berisi versi, contoh: "1".');
  return version;
}

function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        serialize(item),
      ]),
    );
  return value;
}
