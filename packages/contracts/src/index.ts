import { z } from "zod";

export const dependencyStatusSchema = z.enum(["up", "down"]);

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.literal("evflow-api"),
  timestamp: z.string().datetime(),
  dependencies: z.object({
    database: dependencyStatusSchema,
    redis: dependencyStatusSchema,
    object_storage: dependencyStatusSchema,
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  request_id: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const publicContractVersion = "v1" as const;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  company_id: z.string().uuid().optional(),
});

export const loginCompanyOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export type LoginCompanyOption = z.infer<typeof loginCompanyOptionSchema>;

export const companySelectionRequiredSchema = z.object({
  code: z.literal("COMPANY_SELECTION_REQUIRED"),
  companies: z.array(loginCompanyOptionSchema).min(2),
});

export const authPrincipalSchema = z.object({
  user_id: z.string().uuid(),
  membership_id: z.string().uuid(),
  company_id: z.string().uuid(),
  company_name: z.string(),
  display_name: z.string(),
  email: z.string().email(),
  roles: z.array(z.object({ code: z.string(), name: z.string() })),
  permissions: z.array(
    z.object({ code: z.string(), scope_type: z.string(), scope_id: z.string().uuid().nullable() }),
  ),
});

export const authResponseSchema = z.object({ data: authPrincipalSchema });
export type AuthPrincipal = z.infer<typeof authPrincipalSchema>;

/** Active roles of the current company membership, supplied by the authenticated server session. */
export function isAccessAdministrator(principal: Pick<AuthPrincipal, "roles"> | null | undefined) {
  return principal?.roles.some((role) => role.code === "ADMIN_SYSTEM") ?? false;
}

export const dashboardMetricSchema = z.object({
  code: z.string(),
  label: z.string(),
  value: z.number().int().nonnegative(),
  unit: z.literal("institusi"),
  definition_version: z.string(),
  data_as_of: z.string().datetime(),
  updated_at: z.string().datetime(),
  freshness: z.literal("fresh"),
});

export const dashboardSummarySchema = z.object({
  data: z.object({
    company_id: z.string().uuid(),
    as_of: z.string().datetime(),
    sales: z
      .object({
        metrics: z.array(dashboardMetricSchema),
        actions: z.array(
          z.object({
            id: z.string().uuid(),
            prospect_code: z.string(),
            customer_name: z.string(),
            action: z.string(),
            due_at: z.string().datetime(),
          }),
        ),
      })
      .nullable(),
  }),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>["data"];

export const companyProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    legal_name: z.string().trim().max(200).nullable().optional(),
    address: z.string().trim().max(2000).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    logo_object_key: z.string().trim().max(500).nullable().optional(),
    tax_identity: z.string().trim().max(100).nullable().optional(),
  })
  .strict();

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

export const policyUpdateSchema = z
  .object({
    value: jsonValueSchema,
    effective_from: z.string().datetime().optional(),
    reason: z.string().trim().min(3).max(1000).optional(),
    approval_reference: z.string().trim().min(3).max(200).optional(),
  })
  .strict();

export const createUserSchema = z
  .object({
    email: z.string().email(),
    display_name: z.string().trim().min(2).max(200),
    password: z.string().min(12).max(200),
    active: z.boolean().default(true),
    role_ids: z.array(z.string().uuid()).default([]),
  })
  .strict();

export const assignUserRolesSchema = z.object({ role_ids: z.array(z.string().uuid()).max(20) });

export const updateUserSchema = z
  .object({
    display_name: z.string().trim().min(2).max(200),
    email: z.string().email(),
    active: z.boolean(),
    role_ids: z.array(z.string().uuid()).max(20),
  })
  .strict();

export const createRoleSchema = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{2,49}$/),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const rolePermissionInputSchema = z.object({
  permission_id: z.string().uuid(),
  scope_type: z.enum([
    "self",
    "subordinate",
    "department",
    "rayon",
    "warehouse",
    "assigned_portfolio",
    "company",
    "privileged",
  ]),
  scope_id: z.string().uuid().nullable().optional(),
});

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(rolePermissionInputSchema).max(200),
  expected_permissions: z.array(rolePermissionInputSchema).max(200).optional(),
});

const decimalStringSchema = z.string().regex(/^\d+(\.\d+)?$/, "Gunakan angka desimal positif.");
const optionalDecimalStringSchema = decimalStringSchema.optional().nullable();
const stateSchema = z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]);
const optionalObjectSchema = z.record(z.unknown()).nullable().optional();

export const masterResourceSchema = z.enum([
  "product-categories",
  "uoms",
  "customer-channels",
  "rayons",
  "products",
  "customers",
  "suppliers",
  "vendors",
  "warehouses",
  "locators",
  "operational-items",
]);

export const masterStatusSchema = z.object({
  state: stateSchema,
  version: z.number().int().positive(),
});

export const createReferenceMasterSchema = z
  .object({ code: z.string().trim().min(1).max(50), name: z.string().trim().min(2).max(200) })
  .strict();

export const createRayonSchema = createReferenceMasterSchema.extend({
  coverage_notes: z.string().trim().max(1000).nullable().optional(),
});

export const createProductSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    category_id: z.string().uuid(),
    base_uom_id: z.string().uuid(),
    batch_required: z.boolean().default(true),
    expiry_required: z.boolean().default(true),
    serial_required: z.boolean().default(false),
    storage_notes: z.string().trim().max(1000).nullable().optional(),
    storage_profile: z.record(z.unknown()).nullable().optional(),
    shelf_life_days: z.number().int().nonnegative().nullable().optional(),
    permit_type: z.enum(["AKL", "AKD"]).optional(),
    permit_number: z.string().trim().max(100).optional(),
    permit_holder: z.string().trim().max(200).optional(),
    permit_status: z.enum(["PENDING", "VALID", "EXPIRED", "INVALID"]).default("PENDING"),
    purchase_price: optionalDecimalStringSchema,
    sale_price: optionalDecimalStringSchema,
    price_currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("IDR"),
    permit_issued_on: z.string().date().nullable().optional(),
    permit_expires_on: z.string().date().nullable().optional(),
  })
  .strict();

export const updateProductSchema = createProductSchema
  .extend({
    version: z.number().int().positive(),
  })
  .strict();

export const createProductRegistrationSchema = z
  .object({
    permit_type: z.enum(["AKL", "AKD"]),
    permit_number: z.string().trim().min(1).max(100),
    holder: z.string().trim().min(1).max(200),
    issued_on: z.string().date().nullable().optional(),
    expires_on: z.string().date().nullable().optional(),
    evidence_object_key: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const verifyProductRegistrationSchema = z
  .object({
    status: z.enum(["VALID", "EXPIRED", "INVALID"]),
    reason: z.string().trim().min(3).max(1000).optional(),
  })
  .strict();

export const createProductReferencePriceSchema = z
  .object({
    kind: z.enum(["PURCHASE", "SALE"]),
    uom_id: z.string().uuid(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    unit_price: z.string().regex(/^\d{1,16}(\.\d{1,8})?$/),
    effective_from: z.string().datetime(),
    effective_to: z.string().datetime().nullable().optional(),
  })
  .strict();

export const createProductUomSchema = z
  .object({
    uom_id: z.string().uuid(),
    factor_to_base: decimalStringSchema,
    effective_from: z.string().datetime().optional(),
  })
  .strict();

export const createCustomerSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    legal_name: z.string().trim().max(200).nullable().optional(),
    channel_id: z.string().uuid().nullable().optional(),
    rayon_id: z.string().uuid().nullable().optional(),
    relationship_stage: z.enum(["PROSPECT", "REGISTERED"]).default("PROSPECT"),
    primary_address: z.string().trim().max(2000).nullable().optional(),
    shipping_address: z.string().trim().max(2000).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    tax_identity: z.string().trim().max(100).nullable().optional(),
    tax_status: z.string().trim().max(50).nullable().optional(),
    billing_address: z.string().trim().max(2000).nullable().optional(),
    customer_type: z.string().trim().max(100).nullable().optional(),
    potential: z.string().trim().max(100).nullable().optional(),
    collection_schedule: z.string().trim().max(200).nullable().optional(),
    invoice_exchange_schedule: z.string().trim().max(200).nullable().optional(),
    payment_method_preference: z.string().trim().max(100).nullable().optional(),
    payment_tolerance_days: z.number().int().nonnegative().nullable().optional(),
    legal_documents: z.array(z.record(z.unknown())).max(100).nullable().optional(),
    responsible_person: optionalObjectSchema,
    responsible_license: optionalObjectSchema,
    noo_document: optionalObjectSchema,
  })
  .strict();

export const updateCustomerSchema = createCustomerSchema
  .extend({ version: z.number().int().positive() })
  .strict();

const contactSchema = z.record(z.string(), z.string().trim().max(300)).nullable().optional();

export const createSupplierSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    categories: z.array(z.string().trim().min(1).max(100)).min(1).max(10),
    primary_address: z.string().trim().max(2000).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    sales_contact: contactSchema,
    finance_contact: contactSchema,
    shipping_contact: contactSchema,
    tax_identity: z.string().trim().max(100).nullable().optional(),
    technical_responsible_name: z.string().trim().max(200).nullable().optional(),
    agreement_number: z.string().trim().max(100).nullable().optional(),
    legal_documents: z.array(z.record(z.unknown())).max(100).nullable().optional(),
    technical_responsible_license: optionalObjectSchema,
    agreement_details: optionalObjectSchema,
  })
  .strict();

export const updateSupplierSchema = createSupplierSchema
  .extend({ version: z.number().int().positive() })
  .strict();

export const createVendorSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    vendor_type: z.enum(["COMPANY", "INDIVIDUAL"]),
    categories: z.array(z.string().trim().min(1).max(100)).min(1).max(10),
    primary_address: z.string().trim().max(2000).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    order_contact: contactSchema,
    finance_contact: contactSchema,
    service_contact: contactSchema,
    tax_identity: z.string().trim().max(100).nullable().optional(),
    tax_status: z.string().trim().max(50).nullable().optional(),
    agreement_number: z.string().trim().max(100).nullable().optional(),
  })
  .strict();

export const createWarehouseSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    address: z.string().trim().max(2000).nullable().optional(),
    timezone: z.string().trim().min(3).max(100).default("Asia/Makassar"),
  })
  .strict();

export const createLocatorSchema = z
  .object({
    warehouse_id: z.string().uuid(),
    name: z.string().trim().min(2).max(200),
    locator_type: z.enum([
      "RECEIVING",
      "STORAGE",
      "QUARANTINE",
      "TRANSIT",
      "CONSIGNMENT",
      "DISPATCH",
      "RETURN",
    ]),
    pick_sequence: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const createOperationalItemSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    kind: z.enum(["SUPPLY", "ASSET_MODEL", "SERVICE"]),
    category: z.string().trim().min(1).max(100),
    specification: z.string().trim().max(2000).nullable().optional(),
    base_uom_id: z.string().uuid(),
    reference_purchase_price: optionalDecimalStringSchema,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional(),
    minimum_stock: optionalDecimalStringSchema,
    stock_controlled: z.boolean().default(false),
  })
  .strict();

const versioned = { version: z.number().int().positive() };
export const updateVendorSchema = createVendorSchema.extend(versioned).strict();
export const updateWarehouseSchema = createWarehouseSchema.extend(versioned).strict();
// Gudang induk dan satuan dasar tidak diubah lewat update master; pemindahan memakai proses Warehouse.
export const updateLocatorSchema = createLocatorSchema
  .omit({ warehouse_id: true })
  .extend(versioned)
  .strict();
export const updateOperationalItemSchema = createOperationalItemSchema
  .omit({ base_uom_id: true })
  .extend(versioned)
  .strict();

// Kode referensi menjadi identitas yang dirujuk transaksi sehingga tidak diubah lewat update.
export const updateReferenceMasterSchema = createReferenceMasterSchema
  .omit({ code: true })
  .extend(versioned)
  .strict();
export const updateRayonSchema = createRayonSchema.omit({ code: true }).extend(versioned).strict();

export const crmResourceSchema = z.enum(["contacts", "prospects"]);

export const contactFunctionsSchema = z
  .array(z.enum(["PURCHASING", "RECEIVING", "FINANCE", "PRODUCT_USER", "OTHER"]))
  .min(1)
  .max(10);

export const createContactSchema = z
  .object({
    customer_id: z.string().uuid(),
    full_name: z.string().trim().min(2).max(200),
    nickname: z.string().trim().max(100).nullable().optional(),
    job_title: z.string().trim().max(150).nullable().optional(),
    department: z.string().trim().max(150).nullable().optional(),
    pic_functions: contactFunctionsSchema,
    phone: z.string().trim().max(50).nullable().optional(),
    email: z.string().email().nullable().optional(),
    birth_date: z.string().date().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const createProspectNeedSchema = z
  .object({
    product_id: z.string().uuid().nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    estimated_qty: z
      .string()
      .regex(/^\d{1,14}(\.\d{1,10})?$/, "Gunakan maksimal 14 digit bulat dan 10 desimal.")
      .refine((value) => /[1-9]/.test(value), "Estimasi jumlah harus lebih besar dari nol.")
      .optional()
      .nullable(),
    uom_id: z.string().uuid().nullable().optional(),
    needed_on: z.string().date().nullable().optional(),
    needed_period: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => Boolean(value.product_id || value.description), {
    message: "Pilih produk atau isi uraian kebutuhan.",
    path: ["product_id"],
  });

export const createProspectSchema = z
  .object({
    customer_id: z.string().uuid().optional(),
    new_customer: z
      .object({
        name: z.string().trim().min(2).max(200),
        channel_id: z.string().uuid(),
        rayon_id: z.string().uuid().nullable().optional(),
        primary_address: z.string().trim().max(2000).nullable().optional(),
      })
      .strict()
      .optional(),
    source: z.string().trim().max(100).nullable().optional(),
    owner_id: z.string().uuid(),
    contact_ids: z.array(z.string().uuid()).max(100).default([]),
    approach_status: z
      .enum(["NEW", "IN_PROGRESS", "POTENTIAL", "DEFERRED", "DROPPED"])
      .default("NEW"),
    next_action: z.string().trim().max(500).nullable().optional(),
    next_action_at: z.string().datetime().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    needs: z.array(createProspectNeedSchema).max(100).default([]),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.customer_id) === Boolean(value.new_customer))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customer_id"],
        message: "Pilih institusi atau isi institusi baru.",
      });
    if (["DEFERRED", "DROPPED"].includes(value.approach_status) && !value.notes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["notes"],
        message: "Alasan wajib diisi.",
      });
    }
  });

export const createOpportunitySchema = z
  .object({
    prospect_id: z.string().uuid(),
    period: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/),
    source_need_ids: z
      .array(z.string().uuid())
      .min(1)
      .max(100)
      .refine((v) => new Set(v).size === v.length, "Kebutuhan tidak boleh berulang."),
    contact_ids: z.array(z.string().uuid()).max(100).default([]),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const createCrmActivitySchema = z
  .object({
    customer_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    prospect_id: z.string().uuid().optional(),
    opportunity_id: z.string().uuid().optional(),
    kind: z.enum(["NOTE", "CALL", "MEETING", "EMAIL", "FOLLOW_UP"]),
    occurred_at: z.string().datetime(),
    summary: z.string().trim().min(1).max(2000),
    outcome: z.string().trim().max(2000).nullable().optional(),
    next_action: z.string().trim().max(500).nullable().optional(),
    next_action_at: z.string().datetime().nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      Boolean(value.customer_id || value.contact_id || value.prospect_id || value.opportunity_id),
    { message: "Aktivitas harus ditautkan ke pelanggan, kontak, prospek, atau peluang." },
  );

export const registerCrmAttachmentSchema = z
  .object({
    resource_type: z.enum(["customer", "contact", "prospect", "opportunity", "activity"]),
    resource_id: z.string().uuid(),
    object_key: z.string().trim().min(1).max(500),
    original_name: z.string().trim().min(1).max(255),
    mime_type: z.string().trim().min(1).max(150),
    size_bytes: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024),
    sha256: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/)
      .nullable()
      .optional(),
  })
  .strict();

export const createQuoteSchema = z
  .object({
    customer_id: z.string().uuid(),
    prospect_id: z.string().uuid().nullable().optional(),
    opportunity_id: z.string().uuid().nullable().optional(),
    valid_until: z.string().date().nullable().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("IDR"),
    notes: z.string().trim().max(2000).nullable().optional(),
    lines: z
      .array(
        z
          .object({
            source_need_id: z.string().uuid().nullable().optional(),
            product_id: z.string().uuid().nullable().optional(),
            description: z.string().trim().max(500).nullable().optional(),
            quantity: z.string().regex(/^\d{1,14}(\.\d{1,10})?$/),
            uom_id: z.string().uuid(),
            unit_price: z
              .string()
              .regex(/^\d{1,16}(\.\d{1,8})?$/)
              .nullable()
              .optional(),
            discount: z
              .string()
              .regex(/^\d{1,16}(\.\d{1,8})?$/)
              .nullable()
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const createCustomerOrderSchema = z
  .object({
    opportunity_id: z.string().uuid(),
    kind: z.enum(["PO", "SP"]),
    reference_no: z.string().trim().min(1).max(120),
    evidence_attachment_ids: z.array(z.string().uuid()).max(20).default([]),
  })
  .strict();

export const winOpportunitySchema = z
  .object({
    version: z.number().int().positive(),
    customer_order_id: z.string().uuid(),
    maintain_strategy: z.string().trim().min(1).max(2000),
    lines: z
      .array(
        z
          .object({
            opportunity_line_id: z.string().uuid(),
            quantity: z.string().regex(/^\d{1,14}(\.\d{1,10})?$/),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const loseOpportunitySchema = z
  .object({
    version: z.number().int().positive(),
    reason: z.string().trim().min(1).max(2000),
    maintain_strategy: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const addProspectNeedsSchema = z
  .object({
    version: z.number().int().positive(),
    needs: z.array(createProspectNeedSchema).min(1).max(100),
  })
  .strict();

export const activateMasterSchema = z
  .object({
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(1000).optional(),
  })
  .strict();

export type MasterResource = z.infer<typeof masterResourceSchema>;
export * from "./dashboard-sales";
export * from "./dashboard-warehouse";
export * from "./dashboard-finance";
export * from "./dashboard-hris";
export * from "./dashboard-workspace";
export * from "./crm-workspace";
export * from "./otc-ptp";
export * from "./bank-statement-csv";
export * from "./proforma";

/** Display number format from Setting (OPS-FLX-06); Rupiah only for now (CFG-09). */
export type NumberFormat = {
  currency: "IDR";
  thousand_separator: string;
  decimal_separator: string;
  money_decimals: number;
  quantity_decimals: number;
};

export type CompanyPreferences = {
  company_name: string;
  logo_object_key: string | null;
  number_format: NumberFormat | null;
};
