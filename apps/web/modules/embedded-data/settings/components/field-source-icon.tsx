import type { TEmbeddedDataSource } from "@formbricks/types/embedded-data";
import { SOURCE_ICONS } from "../lib/field-labels";

/**
 * The one line of JSX that `field-labels.ts` cannot hold.
 *
 * Which icon a source gets is a mapping, so it lives in `lib/field-labels.ts` where a unit test can
 * reach it — `.tsx` files are excluded from coverage and this repo does not unit-test them, so a
 * mapper parked in one is a mapper nothing can check. This component is the remainder: it renders
 * what that table names, and has no branch of its own to get wrong.
 */
export const FieldSourceIcon = ({
  source,
  className = "size-4",
}: Readonly<{ source: TEmbeddedDataSource; className?: string }>) => {
  const Icon = SOURCE_ICONS[source];
  return <Icon className={className} aria-hidden="true" />;
};
