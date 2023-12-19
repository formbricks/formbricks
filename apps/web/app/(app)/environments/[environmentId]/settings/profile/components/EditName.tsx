"use client";

import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { TUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

import { updateUserAction } from "../actions";

type FormData = {
  name: string;
};

export function EditName({ user }: { user: TUser }) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    watch,
  } = useForm<FormData>();

  const nameValue = watch("name", user.name || "");
  const isNotEmptySpaces = (value: string) => value.trim() !== "";

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      data.name = data.name.trim();
      if (!isNotEmptySpaces(data.name)) {
        toast.error("Please enter at least one character");
        return;
      }
      if (data.name === user.name) {
        toast.success("This is already your name");
        return;
      }
      await updateUserAction({ name: data.name });
      toast.success("Your name was updated successfully");
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
          defaultValue={user.name || ""}
          {...register("name", { required: true })}
        />

        <div className="mt-4">
          <Label htmlFor="email">Email</Label>
          <Input type="email" id="fullname" defaultValue={user.email} disabled />
        </div>
        <Button
          type="submit"
          variant="darkCTA"
          className="mt-4"
          loading={isSubmitting}
          disabled={nameValue === "" || isSubmitting}>
          Update
        </Button>
      </form>
    </>
  );
}
