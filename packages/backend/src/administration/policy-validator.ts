type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  minimum?: number | string;
  maximum?: number | string;
  minLength?: number;
  pattern?: string;
  minItems?: number;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  constraints?: Array<
    | {
        kind: "required_when";
        field: string;
        when: { field: string; operator: "decimal_gt"; value: string };
        message: string;
      }
    | {
        kind: "decimal_sum_equals_when";
        array_field: string;
        item_field: string;
        expected: string;
        when: { field: string; equals: boolean };
        message: string;
      }
  >;
};

export interface ValidationIssue {
  field: string;
  message: string;
}

export function validatePolicyValue(value: unknown, schema: JsonSchema, field = "value") {
  const issues: ValidationIssue[] = [];
  validateNode(value, schema, field, issues);
  validateConstraints(value, schema, field, issues);
  return issues;
}

function validateConstraints(
  value: unknown,
  schema: JsonSchema,
  field: string,
  issues: ValidationIssue[],
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const record = value as Record<string, unknown>;
  for (const constraint of schema.constraints ?? []) {
    if (constraint.kind === "required_when") {
      const candidate = record[constraint.when.field];
      const applies =
        constraint.when.operator === "decimal_gt" &&
        typeof candidate === "string" &&
        /^-?\d+(\.\d+)?$/.test(candidate) &&
        compareDecimals(candidate, constraint.when.value) > 0;
      if (applies && !record[constraint.field]) {
        issues.push({ field: `${field}.${constraint.field}`, message: constraint.message });
      }
    }
    if (constraint.kind === "decimal_sum_equals_when") {
      if (record[constraint.when.field] !== constraint.when.equals) continue;
      const items = record[constraint.array_field];
      if (!Array.isArray(items)) {
        issues.push({ field: `${field}.${constraint.array_field}`, message: constraint.message });
        continue;
      }
      const decimals = items
        .map((item) =>
          item && typeof item === "object"
            ? (item as Record<string, unknown>)[constraint.item_field]
            : undefined,
        )
        .filter((item): item is string => typeof item === "string");
      if (decimals.length !== items.length || !decimalSumEquals(decimals, constraint.expected)) {
        issues.push({ field: `${field}.${constraint.array_field}`, message: constraint.message });
      }
    }
  }
}

function validateNode(
  value: unknown,
  schema: JsonSchema,
  field: string,
  issues: ValidationIssue[],
) {
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((type) => matchesType(value, type))) {
    issues.push({ field, message: `Tipe nilai harus ${types.join(" atau ")}.` });
    return;
  }
  if (schema.enum && !schema.enum.some((candidate) => candidate === value)) {
    issues.push({ field, message: "Nilai tidak termasuk pilihan yang didukung." });
  }
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) {
      issues.push({ field, message: `Panjang minimum ${schema.minLength} karakter.` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      issues.push({ field, message: "Format nilai tidak valid." });
    }
    if (schema.type === "decimal") {
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        issues.push({ field, message: "Nilai decimal harus dikirim sebagai string." });
      } else {
        if (schema.minimum !== undefined && compareDecimals(value, String(schema.minimum)) < 0) {
          issues.push({ field, message: `Nilai minimum ${schema.minimum}.` });
        }
        if (schema.maximum !== undefined && compareDecimals(value, String(schema.maximum)) > 0) {
          issues.push({ field, message: `Nilai maksimum ${schema.maximum}.` });
        }
      }
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < Number(schema.minimum)) {
      issues.push({ field, message: `Nilai minimum ${schema.minimum}.` });
    }
    if (schema.maximum !== undefined && value > Number(schema.maximum)) {
      issues.push({ field, message: `Nilai maksimum ${schema.maximum}.` });
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) {
      issues.push({ field, message: `Minimal ${schema.minItems} item.` });
    }
    if (schema.items) {
      value.forEach((item, index) =>
        validateNode(item, schema.items!, `${field}.${index}`, issues),
      );
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const required of schema.required ?? []) {
      if (!(required in record))
        issues.push({ field: `${field}.${required}`, message: "Wajib diisi." });
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in record) validateNode(record[key], childSchema, `${field}.${key}`, issues);
    }
  }
}

function matchesType(value: unknown, type: string) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "decimal") return typeof value === "string";
  return typeof value === type;
}

function compareDecimals(left: string, right: string) {
  const normalize = (input: string) => {
    const negative = input.startsWith("-");
    const unsigned = negative ? input.slice(1) : input;
    const [integer = "0", fraction = ""] = unsigned.split(".");
    return { negative, integer: integer.replace(/^0+(?=\d)/, ""), fraction };
  };
  const a = normalize(left);
  const b = normalize(right);
  if (a.negative !== b.negative) return a.negative ? -1 : 1;
  const scale = Math.max(a.fraction.length, b.fraction.length);
  const aValue = BigInt(`${a.integer}${a.fraction.padEnd(scale, "0")}`);
  const bValue = BigInt(`${b.integer}${b.fraction.padEnd(scale, "0")}`);
  const comparison = aValue === bValue ? 0 : aValue > bValue ? 1 : -1;
  return a.negative ? -comparison : comparison;
}

function decimalSumEquals(values: string[], expected: string) {
  const scale = Math.max(
    expected.split(".")[1]?.length ?? 0,
    ...values.map((value) => value.split(".")[1]?.length ?? 0),
  );
  const toScaledInteger = (value: string) => {
    const [integer = "0", fraction = ""] = value.split(".");
    return BigInt(`${integer}${fraction.padEnd(scale, "0")}`);
  };
  return (
    values.reduce((sum, value) => sum + toScaledInteger(value), 0n) === toScaledInteger(expected)
  );
}
