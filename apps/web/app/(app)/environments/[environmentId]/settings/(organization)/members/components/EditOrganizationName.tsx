"use client";

import { updateOrganizationNameAction } from "@/app/(app)/environments/[environmentId]/settings/(organization)/members/actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmitHandler, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

interface EditOrganizationNameForm {
  name: string;
}

interface EditOrganizationNameProps {
  environmentId: string;
  organization: TOrganization;
  membershipRole?: TMembershipRole;
}

export const EditOrganizationName = ({ organization, membershipRole }: EditOrganizationNameProps) => {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditOrganizationNameForm>({
    defaultValues: {
      name: organization.name,
    },
  });
  const [isUpdatingOrganization, setIsUpdatingOrganization] = useState(false);
  const { isViewer } = getAccessFlags(membershipRole);

  const organizationName = useWatch({
    control,
    name: "name",
  });

  const isOrganizationNameInputEmpty = !organizationName?.trim();
  const currentOrganizationName = organizationName?.trim().toLowerCase() ?? "";
  const previousOrganizationName = organization?.name?.trim().toLowerCase() ?? "";

  const handleUpdateOrganizationName: SubmitHandler<EditOrganizationNameForm> = async (data) => {
    try {
      data.name = data.name.trim();
      setIsUpdatingOrganization(true);
      const updatedOrganizationResponse = await updateOrganizationNameAction({
        organizationId: organization.id,
        data: { name: data.name },
      });

      if (updatedOrganizationResponse?.data) {
        setIsUpdatingOrganization(false);
        toast.success("Organization name updated successfully.");
      } else {
        const errorMessage = getFormattedErrorMessage(updatedOrganizationResponse);
        toast.error(errorMessage);
      }
      router.refresh();
    } catch (err) {
      setIsUpdatingOrganization(false);
      toast.error(`Error: ${err.message}`);
    }
  };

  return isViewer ? (
    <p className="text-sm text-red-700">You are not authorized to perform this action.</p>
  ) : (
    <form className="w-full max-w-sm items-center" onSubmit={handleSubmit(handleUpdateOrganizationName)}>
      <Label htmlFor="organizationname">Organization Name</Label>
      <Input
        type="text"
        id="organizationname"
        defaultValue={organization?.name ?? ""}
        {...register("name", {
          required: {
            message: "Organization name is required.",
            value: true,
          },
        })}
      />

      {errors?.name?.message && <p className="text-xs text-red-500">{errors.name.message}</p>}

      <Button
        type="submit"
        className="mt-4"
        size="sm"
        loading={isUpdatingOrganization}
        disabled={isOrganizationNameInputEmpty || currentOrganizationName === previousOrganizationName}>
        Update
      </Button>
    </form>
  );
};
