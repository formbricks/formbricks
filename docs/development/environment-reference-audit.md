# Environment Reference Audit

Inventory of references to `environmentId` and `environment`/`environments` across product and docs code.

## Scope

- `apps/web`
- `packages`
- `docs`
- `apps/storybook`
- `openapi.yml`

## Totals

- Files with matches: **290**
- Total `environmentId` matches: **994**
- Total `environment`/`environments` matches: **997**

## File-Level Inventory

| Area | File | environmentId Count | environment/environments Count | Suggested Handling |
| --- | --- | ---: | ---: | --- |
| Product | `apps/storybook/src/stories/Configure.mdx` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/(app)/workspaces/[workspaceId]/(workspace)/integrations/lib/surveys.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/app/(app)/workspaces/[workspaceId]/components/WorkspaceStorageHandler.tsx` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/utils.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/(redirects)/environments/[environmentId]/[...path]/route.ts` | 4 | 0 | Keep route for backward compatibility, but label as legacy/deprecated and redirect to workspace URL shape. |
| Product | `apps/web/app/(redirects)/environments/[environmentId]/route.ts` | 4 | 0 | Keep route for backward compatibility, but label as legacy/deprecated and redirect to workspace URL shape. |
| Product | `apps/web/app/api/(internal)/pipeline/lib/telemetry.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/api/v1/client/[workspaceId]/displays/route.ts` | 1 | 0 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v1/client/[workspaceId]/environment/lib/data.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/app/api/v1/client/[workspaceId]/environment/lib/data.ts` | 0 | 4 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/api/v1/client/[workspaceId]/environment/lib/environmentState.test.ts` | 1 | 1 | Rename test variable names/fixtures to workspaceId while preserving compatibility coverage for legacy environmentId inputs. |
| Product | `apps/web/app/api/v1/client/[workspaceId]/environment/lib/environmentState.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/api/v1/client/[workspaceId]/environment/route.ts` | 1 | 4 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v1/client/[workspaceId]/responses/route.ts` | 1 | 0 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v1/client/[workspaceId]/storage/route.ts` | 1 | 1 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v1/management/action-classes/[actionClassId]/route.ts` | 1 | 1 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v1/management/lib/workspace-resolver.ts` | 3 | 1 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v1/management/me/route.ts` | 0 | 3 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/api/v1/management/responses/route.ts` | 1 | 1 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v1/management/surveys/route.ts` | 1 | 1 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v1/webhooks/route.ts` | 1 | 0 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v2/client/[environmentId]/environment/route.test.ts` | 0 | 9 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/app/api/v2/client/[workspaceId]/displays/route.test.ts` | 8 | 0 | Rename test variable names/fixtures to workspaceId while preserving compatibility coverage for legacy environmentId inputs. |
| Product | `apps/web/app/api/v2/client/[workspaceId]/displays/route.ts` | 1 | 0 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v2/client/[workspaceId]/environment/route.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/api/v2/client/[workspaceId]/responses/route.test.ts` | 7 | 0 | Rename test variable names/fixtures to workspaceId while preserving compatibility coverage for legacy environmentId inputs. |
| Product | `apps/web/app/api/v2/client/[workspaceId]/responses/route.ts` | 1 | 0 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/api/v3/lib/workspace-context.test.ts` | 1 | 0 | Rename test variable names/fixtures to workspaceId while preserving compatibility coverage for legacy environmentId inputs. |
| Product | `apps/web/app/api/v3/lib/workspace-context.ts` | 1 | 0 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/app/lib/api/api-backwards-compat.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/lib/api/api-error-reporter.test.ts` | 0 | 4 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/app/lib/api/parse-and-validate-json-body.test.ts` | 3 | 0 | Rename test variable names/fixtures to workspaceId while preserving compatibility coverage for legacy environmentId inputs. |
| Product | `apps/web/app/lib/api/with-api-logging.test.ts` | 0 | 4 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/app/middleware/domain-utils.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/middleware/endpoint-validator.test.ts` | 0 | 18 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/app/middleware/endpoint-validator.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/middleware/route-config.ts` | 1 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `apps/web/app/sentry/SentryProvider.tsx` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/app/storage/[workspaceId]/[accessType]/[fileName]/route.ts` | 3 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `apps/web/i18n.lock` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/instrumentation-node.ts` | 0 | 9 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/lib/actionClass/service.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/lib/cache/index.test.ts` | 0 | 2 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/lib/constants.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/lib/env.test.ts` | 0 | 3 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/lib/env.ts` | 0 | 5 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/lib/integration/service.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/lib/jwt.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/lib/localStorage.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/lib/organization/service.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/lib/survey/service.test.ts` | 0 | 3 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/lib/utils/resolve-client-id.ts` | 1 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `apps/web/lib/utils/services.ts` | 1 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `apps/web/locales/de-DE.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/en-US.json` | 1 | 12 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/es-ES.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/fr-FR.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/hu-HU.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/ja-JP.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/nl-NL.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/pt-BR.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/pt-PT.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/ro-RO.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/ru-RU.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/sv-SE.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/zh-Hans-CN.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/locales/zh-Hant-TW.json` | 1 | 1 | Update user-facing translations from Environment -> Workspace (or final replacement term); keep temporary key aliases if needed. |
| Product | `apps/web/modules/api/v2/management/contact-attribute-keys/[contactAttributeKeyId]/route.ts` | 0 | 3 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/api/v2/management/lib/workspace-resolver.ts` | 3 | 1 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/modules/api/v2/management/surveys/[surveyId]/contact-links/contacts/[contactId]/route.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/contact.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/api/v2/management/surveys/[surveyId]/contact-links/segments/[segmentId]/lib/tests/contact.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/api/v2/management/surveys/types/surveys.ts` | 1 | 0 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/modules/auth/lib/verification-links.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/core/rate-limit/envoy-rate-limit-coverage.test.ts` | 0 | 4 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/core/rate-limit/envoy-rate-limit-coverage.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/core/rate-limit/rate-limit-load.test.ts` | 0 | 3 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/core/rate-limit/rate-limit.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/ee/contacts/api/v1/management/contact-attribute-keys/route.ts` | 1 | 1 | Use workspaceId as canonical input; retain environmentId only as backward-compatible alias and mark deprecation in comments/docs. |
| Product | `apps/web/modules/ee/contacts/api/v2/management/contacts/bulk/lib/openapi.ts` | 2 | 0 | Update schema/examples to prefer workspaceId; keep environmentId marked as deprecated alias where compatibility is required. |
| Product | `apps/web/modules/ee/contacts/api/v2/management/contacts/bulk/route.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/ee/contacts/api/v2/management/contacts/lib/openapi.ts` | 2 | 3 | Update schema/examples to prefer workspaceId; keep environmentId marked as deprecated alias where compatibility is required. |
| Product | `apps/web/modules/ee/contacts/api/v2/management/contacts/route.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/ee/contacts/lib/attributes.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/ee/license-check/lib/license.test.ts` | 0 | 16 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/ee/license-check/lib/license.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/ee/sso/lib/providers.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/ee/sso/lib/tests/sso-handlers.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/organization/settings/api-keys/lib/api-keys.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/storage/service.test.ts` | 1 | 0 | Rename test variable names/fixtures to workspaceId while preserving compatibility coverage for legacy environmentId inputs. |
| Product | `apps/web/modules/storage/service.ts` | 3 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `apps/web/modules/survey/components/template-list/lib/survey.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/survey/editor/components/edit-welcome-card.tsx` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/survey/editor/components/survey-editor.tsx` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/survey/editor/lib/action-utils.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/survey/editor/lib/workspace.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/survey/link/contact-survey/page.tsx` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/survey/link/page.tsx` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/survey/list/types/surveys.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/survey/templates/components/template-container.tsx` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/ui/components/delete-dialog/stories.tsx` | 0 | 3 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/ui/components/preview-survey/index.tsx` | 0 | 5 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/utils/hooks/useGetBillingInfo.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/modules/workspaces/lib/utils.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/workspaces/settings/(setup)/app-connection/loading.tsx` | 1 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `apps/web/modules/workspaces/settings/(setup)/app-connection/page.tsx` | 1 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `apps/web/modules/workspaces/settings/(setup)/components/ActionActivityTab.tsx` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/modules/workspaces/settings/general/actions.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/next.config.mjs` | 6 | 7 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `apps/web/playwright/api/auth/security.spec.ts` | 0 | 6 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/playwright/js.spec.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/playwright/lib/utils.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/playwright/survey.spec.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/proxy.test.ts` | 0 | 3 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `apps/web/scripts/docker/read-secrets.sh` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/scripts/openapi/merge-client-endpoints.ts` | 10 | 10 | Update schema/examples to prefer workspaceId; keep environmentId marked as deprecated alias where compatibility is required. |
| Product | `apps/web/sentry.edge.config.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/sentry.server.config.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/tsconfig.tsbuildinfo` | 483 | 151 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `apps/web/vite.config.mts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `apps/web/vitestSetup.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Docs | `docs/api-reference/client-api--display/create-display.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/api-reference/client-api--display/update-display.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/api-reference/client-api--people/create-person.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/api-reference/client-api--people/update-person.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/api-reference/client-api--response/create-response.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/api-reference/client-api--response/update-response.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/api-reference/generate-key.mdx` | 0 | 2 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/api-reference/openapi.json` | 85 | 36 | Update schema/examples to prefer workspaceId; keep environmentId marked as deprecated alias where compatibility is required. |
| Docs | `docs/api-v2-reference/introduction.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/api-v2-reference/openapi.yml` | 52 | 35 | Update schema/examples to prefer workspaceId; keep environmentId marked as deprecated alias where compatibility is required. |
| Docs | `docs/api-v3-reference/openapi.yml` | 1 | 8 | Update schema/examples to prefer workspaceId; keep environmentId marked as deprecated alias where compatibility is required. |
| Docs | `docs/development/contribution/contribution.mdx` | 0 | 2 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/development/local-setup/github-codespaces.mdx` | 0 | 2 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/development/standards/organization/file-and-directory-organization.mdx` | 0 | 3 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/development/standards/organization/naming-conventions.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/development/standards/practices/error-handling.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/development/standards/technical/language-specific-conventions.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/development/technical-handbook/background-job-processing.mdx` | 3 | 1 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/development/technical-handbook/database-model.mdx` | 0 | 14 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/development/technical-handbook/tenant-separation.mdx` | 0 | 14 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/docs.json` | 0 | 2 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/overview/open-source.mdx` | 0 | 1 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/advanced/enterprise-features/audit-logging.mdx` | 1 | 1 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/self-hosting/advanced/license-activation.mdx` | 0 | 3 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/advanced/migration.mdx` | 3 | 38 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/self-hosting/advanced/rate-limiting.mdx` | 15 | 2 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/self-hosting/auth-behavior.mdx` | 0 | 6 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/auth-sso/azure-ad-oauth.mdx` | 0 | 3 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/auth-sso/google-oauth.mdx` | 0 | 5 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/auth-sso/keycloak-oidc.mdx` | 0 | 4 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/auth-sso/open-id-connect.mdx` | 0 | 2 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/auth-sso/saml-sso.mdx` | 0 | 1 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/cdn.mdx` | 1 | 0 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/self-hosting/configuration/custom-ssl.mdx` | 0 | 1 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/custom-subpath.mdx` | 0 | 4 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/domain-configuration.mdx` | 5 | 2 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/self-hosting/configuration/environment-variables.mdx` | 0 | 3 | No entity rename: this is deployment env-var documentation, not the deprecated product Environment entity. |
| Docs | `docs/self-hosting/configuration/file-uploads.mdx` | 0 | 5 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/integrations/airtable.mdx` | 0 | 3 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/integrations/google-sheets.mdx` | 0 | 3 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/integrations/n8n.mdx` | 0 | 3 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/integrations/notion.mdx` | 0 | 3 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/integrations/slack.mdx` | 0 | 3 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/configuration/smtp.mdx` | 0 | 6 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/setup/cluster-setup.mdx` | 0 | 4 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/setup/docker.mdx` | 0 | 6 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/setup/kubernetes.mdx` | 0 | 2 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/setup/monitoring.mdx` | 0 | 7 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/self-hosting/setup/one-click.mdx` | 0 | 8 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/core-features/integrations/n8n.mdx` | 0 | 1 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/core-features/integrations/notion.mdx` | 0 | 3 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/core-features/integrations/slack.mdx` | 0 | 4 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/core-features/integrations/webhooks.mdx` | 0 | 5 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/core-features/integrations/wordpress.mdx` | 4 | 2 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/xm-and-surveys/core-features/integrations/zapier.mdx` | 0 | 1 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/core-features/test-environment.mdx` | 0 | 19 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/surveys/general-features/multi-language-surveys.mdx` | 1 | 1 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/xm-and-surveys/surveys/general-features/recall.mdx` | 0 | 1 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/surveys/general-features/spam-protection.mdx` | 0 | 3 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/surveys/general-features/tags.mdx` | 0 | 6 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/surveys/website-app-surveys/actions.mdx` | 0 | 1 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/surveys/website-app-surveys/framework-guides.mdx` | 9 | 24 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/xm-and-surveys/surveys/website-app-surveys/google-tag-manager.mdx` | 3 | 3 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Docs | `docs/xm-and-surveys/surveys/website-app-surveys/quickstart.mdx` | 0 | 1 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/surveys/website-app-surveys/user-identification.mdx` | 0 | 1 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/xm/best-practices/docs-feedback.mdx` | 0 | 10 | Review each mention and rename product-entity Environment wording; keep deployment/runtime environment wording unchanged. |
| Docs | `docs/xm-and-surveys/xm/best-practices/headless-surveys.mdx` | 3 | 6 | Rewrite docs examples to workspaceId and explicitly mention legacy environmentId compatibility window. |
| Product | `openapi.yml` | 4 | 0 | Update schema/examples to prefer workspaceId; keep environmentId marked as deprecated alias where compatibility is required. |
| Product | `packages/ai/src/provider.test.ts` | 0 | 5 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/ai/src/provider.ts` | 0 | 15 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/ai/src/providers/aws.ts` | 0 | 11 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/ai/src/providers/azure.ts` | 0 | 13 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/ai/src/providers/gcp.ts` | 0 | 15 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/ai/src/registry.ts` | 0 | 3 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/ai/src/shared.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/ai/src/text.test.ts` | 0 | 3 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/ai/src/text.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/ai/vite.config.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/cache/.cursor/rules/cache-package.md` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/cache/src/cache-integration.test.ts` | 0 | 2 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/cache/src/cache-keys.test.ts` | 0 | 6 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/cache/src/client.test.ts` | 0 | 2 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/cache/src/client.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/cache/types/error.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/cache/vite.config.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/database/README.md` | 0 | 5 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/database/migration/20230329205933_init/migration.sql` | 10 | 6 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20230405105937_add_api_keys_to_environments/migration.sql` | 3 | 1 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20230505085230_add_webhooks/migration.sql` | 2 | 1 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20230624161355_add_tags/migration.sql` | 3 | 1 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20230915154251_add_integration/migration.sql` | 3 | 1 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20231030105533_add_cascade_delete_to_integrations/migration.sql` | 1 | 1 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20231107145619_add_indexes/migration.sql` | 7 | 1 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20231109052945_restructure_session_action_person/migration.sql` | 2 | 0 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20240207041922_advanced_targeting/migration.sql` | 4 | 1 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20240229141200_add_attribute_class_indexes/migration.sql` | 2 | 0 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20240327140901_add_more_indexes/migration.sql` | 2 | 0 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20240501111944_refactors_actions_and_removes_inline_triggers/migration.sql` | 2 | 0 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20240610055828_adds_app_and_website_status_indicators/migration.sql` | 0 | 1 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20241004070040_removed_website_setup_completed/migration.sql` | 0 | 2 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20241010133706_xm_user_identification/migration.sql` | 3 | 0 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20241017124431_add_documents_and_insights/migration.sql` | 4 | 2 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20241120150728_product_revamp/migration.sql` | 0 | 5 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20241209104738_xm_user_identification/migration.ts` | 11 | 12 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20241209111404_xm_attribute_removal/migration.ts` | 11 | 0 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20250326083401_add_api_keys_to_organization/migration.sql` | 4 | 1 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20250326111101_move_api_keys_to_api_keys_new/migration.ts` | 7 | 4 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20250911192630_remove_deprecated_fields_and_tables/migration.sql` | 0 | 2 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20260204124556_add_language_default_attribute_key/migration.ts` | 2 | 4 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20260330000000_rename_project_to_workspace/migration.sql` | 0 | 3 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20260401000000_add_workspace_id_to_environment_owned_models/migration.sql` | 0 | 3 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20260401000001_promote_dev_environments/migration.ts` | 10 | 21 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20260401000002_backfill_workspace_id/migration.ts` | 2 | 2 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20260402000000_make_workspace_id_not_null/migration.sql` | 8 | 2 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migration/20260403000000_remove_environment_model/migration.sql` | 12 | 6 | No retrofit needed for historical migrations; keep as-is and use new terminology only in future migrations/docs. |
| Product | `packages/database/migrations/20230329205933_init/migration.sql` | 10 | 6 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20230405105937_add_api_keys_to_environments/migration.sql` | 3 | 1 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20230505085230_add_webhooks/migration.sql` | 2 | 1 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20230624161355_add_tags/migration.sql` | 3 | 1 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20230915154251_add_integration/migration.sql` | 3 | 1 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20231030105533_add_cascade_delete_to_integrations/migration.sql` | 1 | 1 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20231107145619_add_indexes/migration.sql` | 7 | 1 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20231109052945_restructure_session_action_person/migration.sql` | 2 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20240207041922_advanced_targeting/migration.sql` | 4 | 1 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20240229141200_add_attribute_class_indexes/migration.sql` | 2 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20240327140901_add_more_indexes/migration.sql` | 2 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20240501111944_refactors_actions_and_removes_inline_triggers/migration.sql` | 2 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20240610055828_adds_app_and_website_status_indicators/migration.sql` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/database/migrations/20241004070040_removed_website_setup_completed/migration.sql` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/database/migrations/20241010133706_xm_user_identification/migration.sql` | 3 | 0 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20241017124431_add_documents_and_insights/migration.sql` | 4 | 2 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20241120150728_product_revamp/migration.sql` | 0 | 5 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/database/migrations/20250326083401_add_api_keys_to_organization/migration.sql` | 4 | 1 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20250911192630_remove_deprecated_fields_and_tables/migration.sql` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/database/migrations/20260330000000_rename_project_to_workspace/migration.sql` | 0 | 3 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/database/migrations/20260401000000_add_workspace_id_to_environment_owned_models/migration.sql` | 0 | 3 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/database/migrations/20260402000000_make_workspace_id_not_null/migration.sql` | 8 | 2 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/database/migrations/20260403000000_remove_environment_model/migration.sql` | 12 | 6 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/email/src/lib/mock-translate.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/i18n-utils/vite.config.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/js-core/README.md` | 0 | 3 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/js-core/src/index.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/js-core/src/lib/common/api.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/js-core/src/lib/common/setup.ts` | 9 | 7 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/js-core/src/lib/common/tests/api.test.ts` | 0 | 3 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/js-core/src/lib/common/tests/setup.test.ts` | 18 | 0 | Rename test variable names/fixtures to workspaceId while preserving compatibility coverage for legacy environmentId inputs. |
| Product | `packages/js-core/src/lib/common/tests/utils.test.ts` | 0 | 2 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/js-core/src/lib/workspace/state.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/js-core/src/lib/workspace/tests/state.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/js-core/src/types/config.ts` | 3 | 1 | Refactor symbol/param names to workspaceId (or final replacement term) and keep compatibility aliases only at boundaries. |
| Product | `packages/js-core/vite.config.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/logger/src/logger.test.ts` | 0 | 4 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/logger/src/logger.ts` | 0 | 4 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/storage/.cursor/rules/storage-package.md` | 0 | 9 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/storage/src/client.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/storage/src/client.ts` | 0 | 4 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/storage/src/constants.test.ts` | 0 | 7 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/storage/src/service.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/storage/vite.config.ts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/survey-ui/vite.config.mts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/surveys/README.md` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/surveys/src/lib/html-utils.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/surveys/src/lib/html-utils.ts` | 0 | 3 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/surveys/src/lib/response.queue.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/surveys/src/lib/styles.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/surveys/src/lib/ttc.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/surveys/src/lib/use-online-status.test.ts` | 0 | 1 | Review wording; keep runtime-environment mentions, but rename product-entity labels to workspace terminology. |
| Product | `packages/surveys/vite.config.mts` | 0 | 1 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
| Product | `packages/types/common.ts` | 0 | 2 | Review mentions and replace product-entity Environment terminology with the new label; keep runtime/deployment uses unchanged. |
