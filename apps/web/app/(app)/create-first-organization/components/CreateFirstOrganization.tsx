"use client";

import { createOrganizationAction } from "@/app/(app)/environments/[environmentId]/actions";
import FormbricksLogo from "@/images/logo.svg";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";

type FormValues = {
  name: string;
};

export const CreateFirstOrganization = () => {
  const router = useRouter();

  const { register, handleSubmit } = useForm<FormValues>();

  const [loading, setLoading] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const isOrganizationNameValid = organizationName.trim() !== "";

  const onCreateOrganization = async (data: FormValues) => {
    data.name = data.name.trim();
    if (!data.name) return;

    try {
      setLoading(true);
      const newOrganization = await createOrganizationAction(data.name);

      toast.success("Organization created successfully!");
      router.push(`/organizations/${newOrganization.id}`);
    } catch (error) {
      console.error(error);
      toast.error(`Unable to create organization`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex w-full items-center justify-start px-8 py-4">
        <Image className="w-6" src={FormbricksLogo} alt="Formbricks Logo" />
        <p className="text ml-4 text-2xl font-bold">Formbricks</p>
      </div>
      <div className="flex h-[calc(100%-12rem)] items-center justify-center border-red-800">
        <form onSubmit={handleSubmit(onCreateOrganization)}>
          <div className="mb-2 flex w-full justify-between space-y-4 rounded-lg px-6">
            <div className="grid w-full gap-3">
              <h1 className="text text-3xl font-extrabold text-slate-800">
                Let&apos;s create an organization <span className="text-primary-500">👇</span>
              </h1>
              <p className="text text-md text-slate-700">
                We couldn&apos;t find an organization for you. Please create one
              </p>
              <div>
                <Input
                  autoFocus
                  placeholder="e.g. Power Puff Girls"
                  {...register("name", { required: true })}
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="px-6">
            <Button
              className="w-full justify-center"
              variant="darkCTA"
              type="submit"
              loading={loading}
              disabled={!isOrganizationNameValid}>
              Create organization
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
