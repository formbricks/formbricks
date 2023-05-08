import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { useAttributeClasses } from "@/lib/attributeClasses/attributeClasses";
import { useAttributeClassMutation } from "@/lib/attributeClasses/mutateAttributeClasses";
import type { AttributeClass } from "@prisma/client";
import { useForm } from "react-hook-form";

interface AttributeSettingsTabProps {
  environmentId: string;
  attributeClass: AttributeClass;
  setOpen: (v: boolean) => void;
}

export default function AttributeSettingsTab({
  environmentId,
  attributeClass,
  setOpen,
}: AttributeSettingsTabProps) {
  const { register, handleSubmit } = useForm({
    defaultValues: { name: attributeClass.name, description: attributeClass.description },
  });
  const { triggerAttributeClassMutate, isMutatingAttributeClass } = useAttributeClassMutation(
    environmentId,
    attributeClass.id
  );

  const { mutateAttributeClasses } = useAttributeClasses(environmentId);

  const onSubmit = async (data) => {
    await triggerAttributeClassMutate(data);
    mutateAttributeClasses();
    setOpen(false);
  };

  return (
    <div>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="">
          <Label className="text-slate-600">Name</Label>
          <Input
            type="text"
            placeholder="e.g. Product Team Info"
            {...register("name", {
              disabled: attributeClass.type === "automatic" || attributeClass.type === "code" ? true : false,
            })}
          />
        </div>
        <div className="">
          <Label className="text-slate-600">Description</Label>
          <Input
            type="text"
            placeholder="e.g. Triggers when user changed subscription"
            {...register("description", {
              disabled: attributeClass.type === "automatic" ? true : false,
            })}
          />
        </div>
        <div className="my-6">
          <Label>Attribute Type</Label>
          {attributeClass.type === "code" ? (
            <p className="text-sm text-slate-600">
              This is a code attribute. You can only change the description.
            </p>
          ) : attributeClass.type === "automatic" ? (
            <p className="text-sm text-slate-600">
              This attribute was added automatically. You cannot make changes to it.
            </p>
          ) : null}
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-6">
          <div>
            <Button
              variant="secondary"
              href="https://formbricks.com/docs/getting-started/identify-users"
              target="_blank">
              Read Docs
            </Button>
          </div>
          {attributeClass.type !== "automatic" && (
            <div className="flex space-x-2">
              <Button type="submit" variant="primary" loading={isMutatingAttributeClass}>
                Save changes
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
