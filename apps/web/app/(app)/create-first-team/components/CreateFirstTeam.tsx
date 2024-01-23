"use client";

import { createTeamAction } from "@/app/(app)/environments/[environmentId]/actions";
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

export default function CreateFirstTeam() {
  const router = useRouter();

  const { register, handleSubmit } = useForm<FormValues>();

  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState("");
  const isTeamNameValid = teamName.trim() !== "";

  const onCreateTeam = async (data: FormValues) => {
    data.name = data.name.trim();
    if (!data.name) return;

    try {
      setLoading(true);
      const newTeam = await createTeamAction(data.name);

      toast.success("Team created successfully!");
      router.push(`/teams/${newTeam.id}`);
    } catch (error) {
      console.error(error);
      toast.error(`Unable to create team`);
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
        <form onSubmit={handleSubmit(onCreateTeam)}>
          <div className="mb-2 flex w-full justify-between space-y-4 rounded-lg px-6">
            <div className="grid w-full gap-3">
              <h1 className="text text-3xl font-extrabold text-slate-800">
                Let&apos;s create a team <span className="text-primary-500">👇</span>
              </h1>
              <p className="text text-md text-slate-700">
                We couldn&apos;t find a team for you. Please create one
              </p>
              <div>
                <Input
                  autoFocus
                  placeholder="e.g. Power Puff Girls"
                  {...register("name", { required: true })}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
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
              disabled={!isTeamNameValid}>
              Create team
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
