---
name: Date Attribute Type Feature
overview: Add DATE type support to the Formbricks attribute system, enabling time-based segment filters like "Sign Up Date is older than 3 months". This involves schema changes, new operators, UI components, SDK updates, and evaluation logic.
todos:
  - id: schema
    content: Add ContactAttributeDataType enum and dataType field to ContactAttributeKey in Prisma schema
    status: completed
  - id: types
    content: "Update type definitions: add data type to contact-attribute-key.ts, add date operators to segment.ts"
    status: completed
  - id: zod
    content: Update Zod schemas in packages/database/zod/ to include dataType
    status: completed
  - id: detect
    content: Create auto-detection logic for attribute data types based on value format
    status: completed
  - id: attributes
    content: Update attribute creation/update logic to auto-detect and persist dataType
    status: completed
  - id: date-utils
    content: Create date utility functions for relative time calculations
    status: completed
  - id: eval-logic
    content: Add date filter evaluation logic to segments.ts evaluateSegment function
    status: completed
  - id: prisma-query
    content: Update prisma-query.ts to handle date comparisons in segment filters
    status: completed
  - id: ui-operators
    content: Update segment-filter.tsx to show date-specific operators when attribute is DATE type
    status: completed
  - id: ui-value
    content: Create date-filter-value.tsx component for date filter value input
    status: completed
  - id: utils
    content: Add date operator text/title conversions in utils.ts
    status: completed
  - id: sdk
    content: Update JS SDK to accept Date objects and convert to ISO strings
    status: completed
  - id: api
    content: Update API endpoints to expose dataType in contact attribute key responses
    status: completed
  - id: i18n
    content: Add translation keys for new operators and UI elements
    status: completed
  - id: tests
    content: Add unit tests for date detection, evaluation, and UI components
    status: completed
---

# Date Attribute Type Feature

## Current State Analysis

The attribute system currently stores all values as strings:

- `ContactAttribute.value` is `String` in Prisma schema (line 73)
- `ContactAttributeKey` has no `dataType` field - only `type` (default/custom)
- Segment filter operators are string/number-focused with no date awareness
- SDK accepts `Record<string, string>` only

## Architecture Changes

### 1. Database Schema Updates

Add `dataType` enum and field to `ContactAttributeKey`:

```prisma
enum ContactAttributeDataType {
  text
  number
  date
}

model ContactAttributeKey {
  // ... existing fields
  dataType ContactAttributeDataType @default(text)
}
```

Store dates as ISO 8601 strings in `ContactAttribute.value` (no schema change needed for value column).

### 2. Type Definitions (`packages/types/`)

**`packages/types/contact-attribute-key.ts`** - Add data type:

```typescript
export const ZContactAttributeDataType = z.enum(["text", "number", "date"]);
export type TContactAttributeDataType = z.infer<typeof ZContactAttributeDataType>;
```

**`packages/types/segment.ts`** - Add date operators:

```typescript
export const DATE_OPERATORS = [
  "isOlderThan",      // relative: X days/weeks/months/years ago
  "isNewerThan",      // relative: within last X days/weeks/months/years
  "isBefore",         // absolute: before specific date
  "isAfter",          // absolute: after specific date
  "isBetween",        // absolute: between two dates
  "isSameDay",        // absolute: matches specific date
] as const;

export const TIME_UNITS = ["days", "weeks", "months", "years"] as const;

export const ZSegmentDateFilter = z.object({
  id: z.string().cuid2(),
  root: z.object({
    type: z.literal("attribute"),
    contactAttributeKey: z.string(),
  }),
  value: z.union([
    // Relative: { amount: 3, unit: "months" }
    z.object({ amount: z.number(), unit: z.enum(TIME_UNITS) }),
    // Absolute: ISO date string or [start, end] for between
    z.string(),
    z.tuple([z.string(), z.string()]),
  ]),
  qualifier: z.object({
    operator: z.enum(DATE_OPERATORS),
  }),
});
```

### 3. Auto-Detection Logic (`apps/web/modules/ee/contacts/lib/`)

Create `detect-attribute-type.ts`:

```typescript
export const detectAttributeDataType = (value: string): TContactAttributeDataType => {
  // Check if valid ISO 8601 date
  const date = new Date(value);
  if (!isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return "date";
  }
  // Check if numeric
  if (!isNaN(Number(value)) && value.trim() !== "") {
    return "number";
  }
  return "text";
};
```

Update `apps/web/modules/ee/contacts/lib/attributes.ts` to auto-detect and set `dataType` when creating new attribute keys.

### 4. Segment Filter UI Components

**New files in `apps/web/modules/ee/contacts/segments/components/`:**

- `date-filter-value.tsx` - Combined component for date filter value input:
  - Relative time: number input + unit dropdown (days/weeks/months/years)
  - Absolute date: date picker component
  - Between: two date pickers for range

- Update `segment-filter.tsx`:
  - Check `contactAttributeKey.dataType` to determine which operators to show
  - Render appropriate value input based on operator type
  - Handle date-specific validation

### 5. Filter Evaluation Logic

Update `apps/web/modules/ee/contacts/segments/lib/segments.ts`:

```typescript
const evaluateDateFilter = (
  attributeValue: string,
  filterValue: TDateFilterValue,
  operator: TDateOperator
): boolean => {
  const attrDate = new Date(attributeValue);
  const now = new Date();

  switch (operator) {
    case "isOlderThan": {
      const threshold = subtractTimeUnit(now, filterValue.amount, filterValue.unit);
      return attrDate < threshold;
    }
    case "isNewerThan": {
      const threshold = subtractTimeUnit(now, filterValue.amount, filterValue.unit);
      return attrDate >= threshold;
    }
    case "isBefore":
      return attrDate < new Date(filterValue);
    case "isAfter":
      return attrDate > new Date(filterValue);
    case "isBetween":
      return attrDate >= new Date(filterValue[0]) && attrDate <= new Date(filterValue[1]);
    case "isSameDay":
      return isSameDay(attrDate, new Date(filterValue));
  }
};
```

### 6. Prisma Query Generation (No Raw SQL)

Update `apps/web/modules/ee/contacts/segments/lib/filter/prisma-query.ts`:

Since dates are stored as ISO 8601 strings, lexicographic string comparison works correctly (e.g., `"2024-01-15" < "2024-02-01"`). Calculate threshold dates in JavaScript and pass as ISO strings:

```typescript
const buildDateAttributeFilterWhereClause = (filter: TSegmentDateFilter): Prisma.ContactWhereInput => {
  const { root, qualifier, value } = filter;
  const { operator } = qualifier;
  const now = new Date();

  let dateCondition: Prisma.StringFilter = {};

  switch (operator) {
    case "isOlderThan": {
      const threshold = subtractTimeUnit(now, value.amount, value.unit);
      dateCondition = { lt: threshold.toISOString() };
      break;
    }
    case "isNewerThan": {
      const threshold = subtractTimeUnit(now, value.amount, value.unit);
      dateCondition = { gte: threshold.toISOString() };
      break;
    }
    case "isBefore":
      dateCondition = { lt: value };
      break;
    case "isAfter":
      dateCondition = { gt: value };
      break;
    case "isBetween":
      dateCondition = { gte: value[0], lte: value[1] };
      break;
    case "isSameDay": {
      const dayStart = startOfDay(new Date(value)).toISOString();
      const dayEnd = endOfDay(new Date(value)).toISOString();
      dateCondition = { gte: dayStart, lte: dayEnd };
      break;
    }
  }

  return {
    attributes: {
      some: {
        attributeKey: { key: root.contactAttributeKey },
        value: dateCondition,
      },
    },
  };
};
```

## Backwards Compatibility Concerns

### 1. API Response Changes (Non-Breaking)

- **Concern**: Adding `dataType` to `ContactAttributeKey` responses
- **Solution**: This is an additive change - existing clients ignore unknown fields
- **Action**: No breaking change, just document the new field

### 2. API Request Changes (Non-Breaking)

- **Concern**: Existing integrations create attributes without specifying `dataType`
- **Solution**: Make `dataType` optional in create/update requests; auto-detect from value if not provided
- **Action**: Default to auto-detection, allow explicit override

### 3. SDK Signature Change (Backwards Compatible)

- **Concern**: Current signature `Record<string, string>` changing to `Record<string, string | Date>`
- **Solution**: TypeScript union types are backwards compatible - existing string values work
- **Action**: Existing code continues to work; Date objects are a new optional capability

### 4. Existing Segment Filters (Critical)

- **Concern**: Existing filters in database use current operator format
- **Solution**: 
  - Keep all existing operators functional
  - Date operators only appear in UI when attribute has `dataType: "date"`
  - Filter evaluation checks operator type and routes to appropriate handler
- **Action**: Add `isDateOperator()` check in evaluation logic

### 5. Filter Value Schema Change (Requires Careful Handling)

- **Concern**: Current `TSegmentFilterValue = string | number`, dates need `{ amount, unit }` for relative
- **Solution**: Extend the union type, not replace:
  ```typescript
  export const ZSegmentFilterValue = z.union([
    z.string(),
    z.number(),
    z.object({ amount: z.number(), unit: z.enum(TIME_UNITS) }), // NEW
    z.tuple([z.string(), z.string()]), // NEW: for "between" operator
  ]);
  ```

- **Action**: Existing filters parse correctly; new format only used for date operators

### 6. Database Migration (Safe)

- **Concern**: Adding `dataType` column to existing `ContactAttributeKey` rows
- **Solution**: 
  - Add column with `@default(text)` 
  - All existing attributes become `text` type automatically
  - No data transformation needed
- **Action**: Simple additive migration, no downtime

### 7. Segment Evaluation at Runtime

- **Concern**: Old segments with text operators should not break
- **Solution**: 
  - `evaluateAttributeFilter()` checks if operator is date-specific
  - If yes, calls `evaluateDateFilter()`
  - If no, uses existing `compareValues()` logic
- **Action**: Add operator type routing in evaluation

### 8. Client-Side Segment Evaluation (JS SDK)

- **Concern**: SDK may evaluate segments client-side for performance
- **Solution**: Ensure SDK's segment evaluation logic also handles date operators
- **Action**: Update `packages/js-core` if client-side evaluation exists

### Version Matrix

| Component | Breaking Change | Migration Required |

|-----------|-----------------|-------------------|

| Database Schema | No | Yes (additive) |

| REST API | No | No |

| JS SDK | No | No (optional upgrade) |

| Existing Segments | No | No |

| UI | No | No |

### 7. SDK Updates (`packages/js-core/`)

Update `packages/js-core/src/lib/user/attribute.ts`:

```typescript
export const setAttributes = async (
  attributes: Record<string, string | Date>
): Promise<Result<void, NetworkError>> => {
  // Convert Date objects to ISO strings
  const normalizedAttributes = Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ])
  );
  // ... rest of implementation
};
```

### 8. API Updates

Update attribute endpoints to include `dataType` in responses:

- `apps/web/modules/api/v2/management/contact-attribute-keys/`
- `apps/web/modules/ee/contacts/api/v1/management/contact-attribute-keys/`

## Files to Modify

| File | Change |

|------|--------|

| `packages/database/schema.prisma` | Add `ContactAttributeDataType` enum, add `dataType` field |

| `packages/types/contact-attribute-key.ts` | Add data type definitions |

| `packages/types/segment.ts` | Add date operators, time units, date filter schema |

| `packages/database/zod/contact-attribute-keys.ts` | Add dataType to zod schema |

| `apps/web/modules/ee/contacts/lib/attributes.ts` | Auto-detect dataType on attribute creation |

| `apps/web/modules/ee/contacts/segments/lib/segments.ts` | Add date filter evaluation |

| `apps/web/modules/ee/contacts/segments/lib/filter/prisma-query.ts` | Add date query building |

| `apps/web/modules/ee/contacts/segments/lib/utils.ts` | Add date operator text/title conversions |

| `apps/web/modules/ee/contacts/segments/components/segment-filter.tsx` | Conditionally render date operators/inputs |

| `packages/js-core/src/lib/user/attribute.ts` | Accept Date objects |

## New Files to Create

| File | Purpose |

|------|---------|

| `apps/web/modules/ee/contacts/lib/detect-attribute-type.ts` | Auto-detection logic |

| `apps/web/modules/ee/contacts/segments/components/date-filter-value.tsx` | Date filter value UI |

| `apps/web/modules/ee/contacts/segments/lib/date-utils.ts` | Date comparison utilities |

## Migration

Create Prisma migration:

```bash
pnpm db:migrate:dev --name add_contact_attribute_data_type
```

Default existing attributes to `text` dataType (no data migration needed).