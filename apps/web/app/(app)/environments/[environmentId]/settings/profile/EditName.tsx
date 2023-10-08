"use client";

import { Button, Input, Label } from "@formbricks/ui";
import { useForm, SubmitHandler } from "react-hook-form";
import toast from "react-hot-toast";
import { updateProfileAction } from "./actions";
import { TProfile } from "@formbricks/types/v1/profile";

type FormData = {
  name: string;
};

export function EditName({ profile }: { profile: TProfile }) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormData>();

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      if (data.name.trim() === "") {
        throw new Error("Please enter at least one character.");
      }
      await updateProfileAction(data);
      toast.success("Your name was updated successfully.");
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    }
  };

  return (
    <>
      <form className="w-full max-w-sm items-center" onSubmit={handleSubmit(onSubmit)}>
        <Label htmlFor="fullname">Full Name</Label>
        <Input
          type="text"
          id="fullname"
          defaultValue={profile.name || ""}
          {...register("name", { required: true })}
        />
        {errors.name && <p className="text-red-500">Please enter at least one character.</p>}

        <div className="mt-4">
          <Label htmlFor="email">Email</Label>
          <Input type="email" id="fullname" defaultValue={profile.email} disabled />
        </div>
        <Button type="submit" variant="darkCTA" className="mt-4" loading={isSubmitting}>
          Update
        </Button>
      </form>
    </>
  );
}
