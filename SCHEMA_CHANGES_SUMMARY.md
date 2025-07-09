# User Schema Changes: Separate First and Last Name Fields

## Overview
Successfully updated the User model in the formbricks-poc project to use separate `firstName` and `lastName` fields instead of a single `name` field.

## Schema Changes

### 1. Database Schema (packages/database/schema.prisma)
- **Changed User model fields:**
  - Removed: `name String`
  - Added: `firstName String` and `lastName String`
- **Updated documentation comments** to reflect the new field structure

### 2. Type Definitions (packages/types/user.ts)
- **Updated ZUser schema:** Changed from `name: ZUserName` to `firstName: ZUserName, lastName: ZUserName`
- **Updated ZUserUpdateInput schema:** Changed from `name: ZUserName.optional()` to `firstName: ZUserName.optional(), lastName: ZUserName.optional()`
- **Updated ZUserCreateInput schema:** Changed from `name: ZUserName` to `firstName: ZUserName, lastName: ZUserName`

## Application Code Updates

### 3. Core User Functions (apps/web/modules/auth/lib/user.ts)
- **Updated createUser function:** Modified select statement to return `firstName` and `lastName` instead of `name`

### 4. Database ZOD Schema (packages/database/zod/users.ts)
- **Updated ZUser description** to reflect that `name` field now represents the full name (concatenated firstName + lastName)

### 5. User Authentication & Signup (apps/web/modules/auth/signup/actions.ts)
- **Updated ZCreatedUser type** to use `firstName` and `lastName`
- **Updated ZCreateUserAction schema** to accept `firstName` and `lastName`
- **Modified all functions** to handle the new field structure:
  - `verifyTurnstileIfConfigured()` - now accepts firstName and lastName parameters
  - `createUserSafely()` - now accepts firstName and lastName parameters
  - `handleInviteAcceptance()` - concatenates firstName and lastName for display
  - `handleOrganizationCreation()` - concatenates firstName and lastName for organization name

### 6. API Endpoints (apps/web/modules/api/v2/organizations/[organizationId]/users/lib/users.ts)
- **Updated getUsers function:** Returns concatenated firstName + lastName as `name` field
- **Updated createUser function:** Splits input `name` into firstName and lastName for storage
- **Updated updateUser function:** Splits input `name` into firstName and lastName for updates
- **Maintained backward compatibility:** API still accepts/returns `name` field for external consumers

### 7. Team Management (apps/web/modules/organization/settings/teams/lib/membership.ts)
- **Updated select statements** to fetch `firstName` and `lastName` instead of `name`
- **Updated mapping functions** to concatenate firstName and lastName for display

### 8. Organization & Team Actions
- **Updated sendInviteMemberEmail calls** to use concatenated firstName + lastName
- **Updated creator name references** to use concatenated firstName + lastName
- **Updated user context references** to use concatenated firstName + lastName

### 9. Additional Files Updated
- **Two-factor authentication** (apps/web/modules/ee/two-factor-auth/lib/two-factor-auth.ts)
- **Email customization** (apps/web/modules/ee/whitelabel/email-customization/actions.ts)
- **Team management** (apps/web/modules/ee/teams/team-list/lib/team.ts)
- **Response utilities** (apps/web/lib/response/utils.ts)

## Migration Required
A database migration will be needed to apply these schema changes:
```bash
npx prisma migrate dev --name "separate-user-first-and-last-name"
```

## Backward Compatibility
- **API endpoints** continue to work with the existing `name` field format
- **Frontend components** that display user names will show the concatenated firstName + lastName
- **Database operations** now use the separate firstName and lastName fields internally

## Notes
- All user display names are now formatted as `${firstName} ${lastName}`
- Input validation remains the same using the existing `ZUserName` schema
- The change maintains data integrity while providing more flexibility for user name management
- All existing functionality has been preserved while using the new field structure