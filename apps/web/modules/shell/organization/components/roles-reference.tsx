import type { TOrganizationRole } from "@formbricks/types/memberships";
import { getOrganizationRoleLabels } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { Badge } from "@/modules/ui/components/badge";
import { SectionHeading } from "./section-heading";

/** The four organization roles and what each one may change; billing exists on Cloud only. */
export const RolesReference = async ({ isFormbricksCloud }: Readonly<{ isFormbricksCloud: boolean }>) => {
  const t = await getTranslate();
  const labels = getOrganizationRoleLabels(t);

  const roles: { role: TOrganizationRole; description: string }[] = [
    { role: "owner", description: t("shell.organization.roles.owner_description") },
    { role: "manager", description: t("shell.organization.roles.manager_description") },
    { role: "member", description: t("shell.organization.roles.member_description") },
  ];
  if (isFormbricksCloud) {
    roles.push({ role: "billing", description: t("shell.organization.roles.billing_description") });
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="roles-heading">
      <SectionHeading
        title={<span id="roles-heading">{t("shell.organization.roles.title")}</span>}
        description={t("shell.organization.roles.description")}
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {roles.map(({ role, description }) => (
          <li key={role} className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-4">
            <Badge type="gray" size="normal" text={labels[role]} />
            <p className="text-slate-700">{description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
