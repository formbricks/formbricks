"use client";

import { Button, Input, Label } from "@formbricks/ui";
import { useForm, SubmitHandler } from "react-hook-form";
import { useState } from "react";
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
    formState: { isSubmitting },
  } = useForm<FormData>();

  const [isButtonDisabled, setButtonDisabled] = useState(false);
  const [nameValue, setNameValue] = useState(profile.name || "");

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newNameValue = e.target.value;
    setNameValue(newNameValue);
    setButtonDisabled(newNameValue === "");
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      if (nameValue === "") {
        toast.error("Please enter at least one character.");
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
          value={nameValue}
          {...register("name", { required: true })}
          onChange={handleNameChange}
        />

        <div className="mt-4">
          <Label htmlFor="email">Email</Label>
          <Input type="email" id="fullname" defaultValue={profile.email} disabled />
        </div>
        <Button
          type="submit"
          variant="darkCTA"
          className="mt-4"
          loading={isSubmitting}
          disabled={isButtonDisabled}>
          Update
        </Button>
      </form>
    </>
  );
}
