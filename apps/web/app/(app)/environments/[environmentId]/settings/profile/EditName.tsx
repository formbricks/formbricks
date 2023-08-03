"use client";

import { Button, Input, Label } from "@formbricks/ui";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { profileEditAction } from "./action";
import { useState } from "react";
import { TProfile } from "@formbricks/types/v1/profile";

export async function EditName({ profile }: { profile: TProfile }) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  return (
    <>
      {profile && (
        <form
          className="w-full max-w-sm items-center"
          onSubmit={handleSubmit((data) => {
            profileEditAction(profile.id, data)
              .then(() => {
                toast.success("Your name was updated successfully.");
              })
              .catch((error) => {
                toast.error(`Error: ${error.message}`);
              });
          })}>
          <Label htmlFor="fullname">Full Name</Label>
          <Input
            type="text"
            id="fullname"
            defaultValue={profile.name ? profile.name : ""}
            {...register("name")}
          />

          <div className="mt-4">
            <Label htmlFor="email">Email</Label>
            <Input type="email" id="fullname" defaultValue={profile.email} disabled />
          </div>
          <Button type="submit" variant="darkCTA" className="mt-4" loading={isSubmitting}>
            Update
          </Button>
        </form>
      )}
    </>
  );
}
