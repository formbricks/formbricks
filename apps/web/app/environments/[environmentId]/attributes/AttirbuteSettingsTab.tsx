import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { AttributeClass } from "@prisma/client";

interface AttributeSettingsTabProps {
  attributeClass: AttributeClass;
}

export default function AttributeSettingsTab({ attributeClass }: AttributeSettingsTabProps) {
  return (
    <div>
      <form className="space-y-4">
        <div className="">
          <Label className="text-slate-600">Name</Label>
          <Input type="text" placeholder="e.g. Product Team Info" defaultValue={attributeClass.name} />
        </div>
        <div className="">
          <Label className="text-slate-600">Description</Label>
          <Input
            type="text"
            placeholder="e.g. Triggers when user changed subscription"
            defaultValue={attributeClass.description || ""}
          />
        </div>
      </form>
    </div>
  );
}
