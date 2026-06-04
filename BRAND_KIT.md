# Brand Kit Feature

## Overview

The Brand Kit feature allows organizations to create and manage centralized branding guidelines for surveys. This enables consistent visual styling across all surveys within an organization while maintaining flexibility at the workspace and survey levels.

## Features

### Core Functionality

- **Organization-wide Style Guides**: Create branded style guides at the organization level
- **Flexible Configuration**: Customize colors, typography, spacing, and logo
- **Workspace Activation**: Enable/disable style guides per workspace
- **Version Management**: Track style guide versions and authors
- **Easy Management**: Create, edit, and delete style guides

### Styling Options

Each style guide supports:
- **Brand Color**: Primary brand color (hex format)
- **Accent Color**: Secondary accent color (optional)
- **Font Family**: Typography specification
- **Font Size**: Default font size
- **Border Radius**: Rounded corner specifications
- **Logo**: Image with alt text and dimensions
- **Custom Colors**: Additional color mappings
- **Version**: Version identifier
- **Authors**: Attribution information
- **External Documentation**: Link to style guide documentation

## Database Schema

### StyleGuide Model

```prisma
model StyleGuide {
  id                        String   @id @default(cuid())
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  name                      String   // e.g., "Brand Kit 2024"
  organizationId            String   // Links to Organization
  brandColor                String?  // Hex color, e.g., "#FF0000"
  accentColor               String?  // Optional secondary color
  borderRadius              String?  // CSS value, e.g., "8px"
  fontSize                  String?  // CSS value, e.g., "16px"
  fontFamily                String?  // Font family spec
  logo                      Json?    // Logo configuration with URL, alt, dimensions
  customColors              Json?    // Additional color mappings
  version                   String?  // Version identifier
  authors                   String?  // Attribution
  externalDocumentation     String?  // URL to documentation
  workspaceConfig           Json     // Maps workspaceId -> enabled/disabled
  isActive                  Boolean  @default(true)
}
```

### Workspace Extension

```prisma
model Workspace {
  // ... existing fields ...
  activeStyleGuideId        String?  // Reference to active StyleGuide
}
```

## API Endpoints

### Organization-level Endpoints

#### List and Create Style Guides
```
GET/POST /api/v1/management/organizations/{organizationId}/style-guides
```

### StyleGuide Management Endpoints

#### Get/Update/Delete Specific StyleGuide
```
GET/PATCH/DELETE /api/v1/management/style-guides/{styleGuideId}
```

### Workspace-level Endpoints

#### Get Active Style Guide
```
GET /api/v1/management/workspaces/{workspaceId}/active-style-guide
```

#### Workspace Style Guide Configuration
```
POST /api/v1/management/workspaces/{workspaceId}/style-guides/{styleGuideId}
Body: { action: "enable" | "disable" | "activate" | "deactivate" }
```

## Server Actions

All server actions include proper permission checks:

- `createStyleGuideAction()` - Create new style guide (owner-only)
- `updateStyleGuideAction()` - Update style guide (owner-only)
- `deleteStyleGuideAction()` - Delete style guide (owner-only)
- `getStyleGuidesAction()` - List style guides (member access)
- `enableStyleGuideForWorkspaceAction()` - Enable for workspace
- `disableStyleGuideForWorkspaceAction()` - Disable for workspace
- `setActiveStyleGuideForWorkspaceAction()` - Set as active

## UI Components

### Style Guides List Page
- Located at: `/settings/organization/style-guides`
- Shows all organization style guides
- Create, edit, delete, and activate options
- Card-based layout with preview

### Style Guide Editor
- Located at: `/settings/organization/style-guides/{id}`
- Edit all style guide properties
- Live preview of changes
- Color picker with hex input
- Save changes (owner-only)

### Create Modal
- Quick creation of new style guides
- Minimal fields required (name, brand color)

## Utility Functions

### Get Active Style Guide
```typescript
import { getActiveStyleGuideForWorkspace } from "@/lib/style-guides/utils";

const styleGuide = await getActiveStyleGuideForWorkspace(workspaceId);
```

### Apply to Survey Theme
```typescript
import { applyStyleGuideToSurveyTheme } from "@/lib/style-guides/utils";

const theme = applyStyleGuideToSurveyTheme(styleGuide);
// Use theme object in survey configuration
```

### Generate CSS Variables
```typescript
import { convertStyleGuideToCSS } from "@/lib/style-guides/utils";

const cssString = convertStyleGuideToCSS(styleGuide);
// Can be injected into survey context
```

## React Hooks

### useActiveStyleGuide
```typescript
const { styleGuide, isLoading, error } = useActiveStyleGuide(workspaceId);
```

### useStyleGuides
```typescript
const { styleGuides, isLoading, error } = useStyleGuides(organizationId);
```

## Access Control

- **Organization Owners**: Can create, update, and delete style guides
- **Organization Members**: Can view style guides
- **Workspace Owners**: Can activate/deactivate style guides for their workspace
- **Workspace Members**: Can view active style guide

## Type Safety

All StyleGuide operations use Zod schemas:

```typescript
import { ZStyleGuideCreate, ZStyleGuideUpdate, ZStyleGuide } from "@formbricks/types/style-guide";
```

## Migration

The database migration adds:
1. `StyleGuide` table with proper indexes and constraints
2. `activeStyleGuideId` column to `Workspace` table
3. Foreign key relationships for data integrity

Run with:
```bash
pnpm db:migrate:dev
```

## Future Enhancements

### Scope 2: Custom Brand Kit
- Image upload and color extraction
- AI-powered color palette generation
- Image-to-brand-kit automation

### Scope 3: Accessible Brand Kit
- Accessibility compliance checker
- Color contrast validation
- WCAG guideline compliance

### Additional Features
- Survey-level style guide overrides
- Style guide templates
- Collaborative editing with versioning
- Style guide marketplace
- A/B testing with different brand kits

## Best Practices

1. **One Brand Kit per Organization**: Maintain a single source of truth
2. **Version Your Guides**: Track changes with version numbers
3. **Document Changes**: Use authors and documentation fields
4. **Test Before Rolling Out**: Preview changes before activating
5. **Archive Old Guides**: Keep old guides for reference

## Troubleshooting

### Style Guide Not Applied
- Verify `activeStyleGuideId` is set on the workspace
- Check that the style guide hasn't been deleted
- Ensure proper workspace configuration in `workspaceConfig`

### Permission Denied Errors
- Confirm user has owner role in organization
- Check workspace membership

### Colors Not Rendering
- Validate hex color format (#RRGGBB)
- Ensure color values are properly saved

## Examples

### Creating a Brand Kit
```typescript
const styleGuide = await createStyleGuideAction(organizationId, {
  name: "Corporate Brand 2024",
  brandColor: "#1F2937",
  accentColor: "#3B82F6",
  fontFamily: "Inter, sans-serif",
  fontSize: "14px",
  borderRadius: "8px",
  version: "1.0.0",
  authors: "Design Team",
});
```

### Activating for a Workspace
```typescript
await setActiveStyleGuideForWorkspaceAction(workspaceId, styleGuide.id);
```

### Using in a Survey
```typescript
const styleGuide = await getActiveStyleGuideForWorkspace(workspaceId);
const surveyTheme = applyStyleGuideToSurveyTheme(styleGuide);
// Apply surveyTheme to survey configuration
```
