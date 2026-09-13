/**
 * Schema inference from observed JSON / form values. Samples are accumulated
 * into one `InferredSchema` per body so that every call to an endpoint (and
 * every item of an array) contributes to the final shape.
 */

export type JsonKind = "null" | "boolean" | "integer" | "number" | "string" | "array" | "object";

export type StringFormat = "date-time" | "date" | "email" | "uri" | "uuid" | "binary";

export interface InferredSchema {
	kinds: Set<JsonKind>;
	/** Number of values merged into this node. */
	samples: number;
	/** Formats of the observed strings; "" marks a string with no recognised format. */
	stringFormats: Set<StringFormat | "">;
	properties: Map<string, InferredSchema>;
	/** Number of object values merged, used to decide which properties are required. */
	objectSamples: number;
	/** Value schema for objects that behave like dictionaries keyed by ids. */
	additionalProperties: InferredSchema | null;
	items: InferredSchema | null;
}

export type OpenApiSchema = Record<string, unknown>;

const MAX_DEPTH = 32;
const MAX_ARRAY_ITEMS = 1000;
const MAX_OBJECT_PROPERTIES = 200;
const MAX_FORMAT_LENGTH = 256;

const KIND_ORDER: JsonKind[] = [
	"object",
	"array",
	"string",
	"integer",
	"number",
	"boolean",
	"null",
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[a-z]{2,}$/i;
const URI = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i;
const ID_KEY =
	/^(?:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24})$/i;

export function createSchema(): InferredSchema {
	return {
		kinds: new Set(),
		samples: 0,
		stringFormats: new Set(),
		properties: new Map(),
		objectSamples: 0,
		additionalProperties: null,
		items: null,
	};
}

function detectStringFormat(value: string): StringFormat | "" {
	if (value.length === 0 || value.length > MAX_FORMAT_LENGTH) return "";
	if (UUID.test(value)) return "uuid";
	if (DATE.test(value) && !Number.isNaN(Date.parse(value))) return "date";
	if (DATE_TIME.test(value) && !Number.isNaN(Date.parse(value))) {
		return "date-time";
	}
	if (EMAIL.test(value)) return "email";
	if (URI.test(value)) return "uri";
	return "";
}

function isDictionaryLike(keys: string[]): boolean {
	if (keys.length > MAX_OBJECT_PROPERTIES) return true;
	return keys.length >= 2 && keys.every((key) => ID_KEY.test(key));
}

/** Merges one observed JSON value into `schema`. */
export function addSample(schema: InferredSchema, value: unknown, depth = 0): void {
	schema.samples++;

	if (value === null || value === undefined) {
		schema.kinds.add("null");
		return;
	}
	if (typeof value === "boolean") {
		schema.kinds.add("boolean");
		return;
	}
	if (typeof value === "number") {
		schema.kinds.add(Number.isInteger(value) ? "integer" : "number");
		return;
	}
	if (typeof value === "string") {
		schema.kinds.add("string");
		schema.stringFormats.add(detectStringFormat(value));
		return;
	}
	if (Array.isArray(value)) {
		schema.kinds.add("array");
		if (depth >= MAX_DEPTH) return;
		const limit = Math.min(value.length, MAX_ARRAY_ITEMS);
		for (let i = 0; i < limit; i++) {
			schema.items ??= createSchema();
			addSample(schema.items, value[i], depth + 1);
		}
		return;
	}
	if (typeof value === "object") {
		schema.kinds.add("object");
		schema.objectSamples++;
		if (depth >= MAX_DEPTH) return;
		const record = value as Record<string, unknown>;
		const keys = Object.keys(record);
		if (isDictionaryLike(keys)) {
			const limit = Math.min(keys.length, MAX_ARRAY_ITEMS);
			for (let i = 0; i < limit; i++) {
				schema.additionalProperties ??= createSchema();
				addSample(schema.additionalProperties, record[keys[i]], depth + 1);
			}
			return;
		}
		for (const key of keys) {
			let property = schema.properties.get(key);
			if (!property) {
				property = createSchema();
				schema.properties.set(key, property);
			}
			addSample(property, record[key], depth + 1);
		}
		return;
	}
	// bigint / symbol / function cannot come out of JSON.parse.
	schema.kinds.add("string");
	schema.stringFormats.add("");
}

export interface FormSampleField {
	name: string;
	value: string;
	isFile?: boolean;
}

/** Merges one submitted form (url-encoded or multipart) into `schema`. */
export function addFormSample(schema: InferredSchema, fields: FormSampleField[]): void {
	schema.samples++;
	schema.kinds.add("object");
	schema.objectSamples++;
	const seen = new Set<string>();
	for (const field of fields) {
		// Repeated form keys describe one property, not several samples.
		if (seen.has(field.name)) continue;
		seen.add(field.name);
		let property = schema.properties.get(field.name);
		if (!property) {
			property = createSchema();
			schema.properties.set(field.name, property);
		}
		property.samples++;
		property.kinds.add("string");
		property.stringFormats.add(field.isFile ? "binary" : detectStringFormat(field.value));
	}
}

export function inferSchema(value: unknown): InferredSchema {
	const schema = createSchema();
	addSample(schema, value);
	return schema;
}

function getKinds(schema: InferredSchema): { kinds: JsonKind[]; nullable: boolean } {
	const kinds = new Set(schema.kinds);
	const nullable = kinds.delete("null");
	if (kinds.has("integer") && kinds.has("number")) kinds.delete("integer");
	return {
		kinds: [...kinds].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b)),
		nullable,
	};
}

function getStringFormat(schema: InferredSchema): StringFormat | null {
	if (schema.stringFormats.size !== 1) return null;
	const [format] = schema.stringFormats;
	return format || null;
}

function isRequiredProperty(parent: InferredSchema, property: InferredSchema): boolean {
	// A single observation cannot tell optional fields from required ones.
	return parent.objectSamples >= 2 && property.samples >= parent.objectSamples;
}

/** Whether the property is known to be missing from some observed objects. */
function isOptionalProperty(parent: InferredSchema, property: InferredSchema): boolean {
	return parent.objectSamples >= 2 && property.samples < parent.objectSamples;
}

function kindToOpenApi(schema: InferredSchema, kind: JsonKind): OpenApiSchema {
	switch (kind) {
		case "string": {
			const format = getStringFormat(schema);
			return format ? { type: "string", format } : { type: "string" };
		}
		case "array":
			return {
				type: "array",
				items: schema.items ? toOpenApiSchema(schema.items) : {},
			};
		case "object": {
			const result: OpenApiSchema = { type: "object" };
			if (schema.properties.size > 0) {
				const properties: Record<string, OpenApiSchema> = {};
				const required: string[] = [];
				for (const [name, property] of schema.properties) {
					properties[name] = toOpenApiSchema(property);
					if (isRequiredProperty(schema, property)) required.push(name);
				}
				result.properties = properties;
				if (required.length > 0) result.required = required;
			}
			if (schema.additionalProperties) {
				result.additionalProperties = toOpenApiSchema(schema.additionalProperties);
			}
			return result;
		}
		default:
			return { type: kind };
	}
}

/** Converts an inferred schema into a valid OpenAPI 3.0.x Schema Object. */
export function toOpenApiSchema(schema: InferredSchema): OpenApiSchema {
	const { kinds, nullable } = getKinds(schema);
	if (kinds.length === 0) {
		return nullable ? { nullable: true, description: "Only null values were observed." } : {};
	}
	const variants = kinds.map((kind) => kindToOpenApi(schema, kind));
	if (variants.length === 1) {
		return nullable ? { ...variants[0], nullable: true } : variants[0];
	}
	// The variants have disjoint types, so null may only be allowed by one of
	// them or `oneOf` would match twice.
	if (nullable) variants[0] = { ...variants[0], nullable: true };
	return { oneOf: variants };
}

/** Human readable type, e.g. "string (date-time)", "array of object", "integer | null". */
function describeSchemaType(schema: InferredSchema): string {
	const { kinds, nullable } = getKinds(schema);
	const parts = kinds.map((kind) => {
		if (kind === "string") {
			const format = getStringFormat(schema);
			return format ? `string (${format})` : "string";
		}
		if (kind === "array") {
			if (!schema.items || schema.items.kinds.size === 0) return "array";
			const itemType = describeSchemaType(schema.items);
			return `array of ${itemType.includes(" | ") ? `(${itemType})` : itemType}`;
		}
		if (kind === "object" && schema.additionalProperties && schema.properties.size === 0) {
			return `map of ${describeSchemaType(schema.additionalProperties)}`;
		}
		return kind;
	});
	if (nullable) parts.push("null");
	return parts.join(" | ") || "unknown";
}

export interface SchemaLine {
	depth: number;
	/** Property name, `{key}` for dictionary values, or null for the root value. */
	name: string | null;
	type: string;
	optional: boolean;
}

/** Nested object shapes to describe below a node (for objects and arrays of objects). */
function getChildren(schema: InferredSchema): InferredSchema | null {
	let node: InferredSchema | null = schema;
	let guard = 0;
	while (node && guard++ < MAX_DEPTH) {
		if (node.properties.size > 0 || node.additionalProperties) return node;
		node = node.kinds.has("array") ? node.items : null;
	}
	return null;
}

/**
 * Flattens a schema into indented lines for Markdown / plain-text rendering.
 * Output is capped so enormous responses cannot blow up the documentation.
 */
export function flattenSchema(
	schema: InferredSchema,
	maxLines = 400
): {
	lines: SchemaLine[];
	truncated: number;
} {
	const lines: SchemaLine[] = [];
	let truncated = 0;

	const push = (line: SchemaLine) => {
		if (lines.length < maxLines) lines.push(line);
		else truncated++;
	};

	const walkObject = (node: InferredSchema, depth: number) => {
		for (const [name, property] of node.properties) {
			push({
				depth,
				name,
				type: describeSchemaType(property),
				optional: isOptionalProperty(node, property),
			});
			const children = getChildren(property);
			if (children && depth < MAX_DEPTH) walkObject(children, depth + 1);
		}
		if (node.additionalProperties) {
			push({
				depth,
				name: "{key}",
				type: describeSchemaType(node.additionalProperties),
				optional: false,
			});
			const children = getChildren(node.additionalProperties);
			if (children && depth < MAX_DEPTH) walkObject(children, depth + 1);
		}
	};

	const { kinds, nullable } = getKinds(schema);
	if (kinds.length === 1 && kinds[0] === "object" && !nullable && schema.properties.size > 0) {
		walkObject(schema, 0);
	} else {
		push({ depth: 0, name: null, type: describeSchemaType(schema), optional: false });
		const children = getChildren(schema);
		if (children) walkObject(children, 1);
	}

	return { lines, truncated };
}
