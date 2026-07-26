// Canonical inventory schema — the single target shape every upload is mapped to.

export type CanonicalField =
  | 'sku'
  | 'name'
  | 'description'
  | 'category'
  | 'quantity'
  | 'unit'
  | 'unit_price'
  | 'currency'
  | 'location'
  | 'owner'
  | 'supplier'
  | 'reorder_level'
  | 'status'
  | 'assigned_to';

export type FieldType = 'string' | 'number';

export interface FieldDef {
  field: CanonicalField;
  type: FieldType;
  /** Lower-cased header synonyms matched deterministically before the LLM runs. */
  synonyms: string[];
  description: string;
}

export const FIELD_DEFS: FieldDef[] = [
  {
    field: 'sku',
    type: 'string',
    synonyms: ['sku', 'item code', 'item_code', 'itemcode', 'code', 'part number', 'part_no', 'partno', 'product id', 'product_id', 'id', 'barcode', 'upc'],
    description: 'Stock keeping unit / unique item code',
  },
  {
    field: 'name',
    type: 'string',
    synonyms: ['name', 'item', 'item name', 'item_name', 'product', 'product name', 'product_name', 'title', 'description short', 'material'],
    description: 'Human-readable item name',
  },
  {
    field: 'description',
    type: 'string',
    synonyms: ['description', 'desc', 'details', 'notes', 'long description', 'spec', 'specification'],
    description: 'Longer free-text description of the item',
  },
  {
    field: 'category',
    type: 'string',
    synonyms: ['category', 'type', 'group', 'department', 'class', 'family', 'segment'],
    description: 'Category / grouping of the item',
  },
  {
    field: 'quantity',
    type: 'number',
    synonyms: ['quantity', 'qty', 'qty on hand', 'qty_on_hand', 'on hand', 'stock', 'stock level', 'in stock', 'count', 'units', 'available'],
    description: 'Quantity currently in stock',
  },
  {
    field: 'unit',
    type: 'string',
    synonyms: ['unit', 'uom', 'unit of measure', 'measure', 'units of measure', 'pack'],
    description: 'Unit of measure (each, box, kg, litre, ...)',
  },
  {
    field: 'unit_price',
    type: 'number',
    synonyms: ['unit price', 'unit_price', 'price', 'cost', 'unit cost', 'unit_cost', 'rate', 'mrp', 'selling price', 'value'],
    description: 'Price/cost per unit',
  },
  {
    field: 'currency',
    type: 'string',
    synonyms: ['currency', 'ccy', 'curr'],
    description: 'Currency code for unit_price (USD, INR, ...)',
  },
  {
    field: 'location',
    type: 'string',
    synonyms: ['location', 'warehouse', 'bin', 'shelf', 'aisle', 'store', 'site', 'rack'],
    description: 'Physical storage location',
  },
  {
    field: 'owner',
    type: 'string',
    synonyms: ['owner', 'customer', 'client', 'account', 'tenant', 'belongs to', 'asset owner', 'customer name', 'client name', 'company', 'organisation', 'organization'],
    description: 'Customer / owner the asset belongs to (whose stock this is)',
  },
  {
    field: 'supplier',
    type: 'string',
    synonyms: ['supplier', 'vendor', 'manufacturer', 'brand', 'maker', 'source company'],
    description: 'Supplier or vendor the item was bought from',
  },
  {
    field: 'reorder_level',
    type: 'number',
    synonyms: ['reorder level', 'reorder_level', 'reorder point', 'min stock', 'min_stock', 'minimum', 'threshold', 'safety stock'],
    description: 'Stock level at which the item should be reordered',
  },
  {
    field: 'status',
    type: 'string',
    synonyms: ['status', 'state', 'condition', 'lifecycle', 'stage', 'disposition'],
    description: 'Lifecycle status (in stock, deployed, in repair, retired, recycled)',
  },
  {
    field: 'assigned_to',
    type: 'string',
    synonyms: ['assigned to', 'assigned_to', 'assignee', 'holder', 'user', 'custodian', 'issued to', 'checked out to', 'in use by'],
    description: 'Person the asset is currently issued to / in use by',
  },
];

export const CANONICAL_FIELDS: CanonicalField[] = FIELD_DEFS.map((f) => f.field);

export const FIELD_TYPE: Record<CanonicalField, FieldType> = Object.fromEntries(
  FIELD_DEFS.map((f) => [f.field, f.type]),
) as Record<CanonicalField, FieldType>;

export interface CanonicalItem {
  sku: string | null;
  name: string | null;
  description: string | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  currency: string | null;
  location: string | null;
  owner: string | null;
  supplier: string | null;
  reorder_level: number | null;
  status: string | null;
  assigned_to: string | null;
  raw: Record<string, unknown>;
}
