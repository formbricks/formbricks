"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { TProject, ZProject } from "@formbricks/types/project";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem, FormLabel, FormProvider } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { updateProjectAction } from "../../actions";

type EditDefaultRewardProps = {
  environmentId: string;
  project: TProject;
};

const ZDefaultRewardInput = ZProject.pick({ defaultRewardInUSD: true });

type TEditDefaultReward = z.infer<typeof ZDefaultRewardInput>;

export const EditDefaultRewardForm: React.FC<EditDefaultRewardProps> = ({ project }) => {
  const form = useForm<TEditDefaultReward>({
    defaultValues: {
      defaultRewardInUSD: project.defaultRewardInUSD,
    },
    resolver: zodResolver(ZDefaultRewardInput),
    mode: "onChange",
  });

  const { errors, isDirty } = form.formState;

  const rewardError = errors.defaultRewardInUSD?.message;
  const isSubmitting = form.formState.isSubmitting;

  const updateDefaultReward: SubmitHandler<TEditDefaultReward> = async (data) => {
    try {
      if (rewardError) {
        toast.error(rewardError);
        return;
      }

      const updatedProjectResponse = await updateProjectAction({
        projectId: project.id,
        data: {
          defaultRewardInUSD: data.defaultRewardInUSD,
        },
      });

      if (updatedProjectResponse?.data) {
        toast.success("Default reward updated successfully.");
        form.resetField("defaultRewardInUSD", {
          defaultValue: updatedProjectResponse.data.defaultRewardInUSD,
        });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedProjectResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Error: Unable to save project information`);
    }
  };

  return (
    <FormProvider {...form}>
      <form
        className="w-full max-w-sm items-center space-y-2"
        onSubmit={form.handleSubmit(updateDefaultReward)}>
        <FormField
          control={form.control}
          name="defaultRewardInUSD"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="defaultRewardInUSD">
                Amount received for successful survey completion in USD:
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  id="defaultRewardInUSD"
                  step="0.01"
                  {...field}
                  placeholder="0.00"
                  autoComplete="off"
                  required
                  isInvalid={!!rewardError}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <Button type="submit" size="sm" loading={isSubmitting} disabled={isSubmitting || !isDirty}>
          Update
        </Button>
      </form>
    </FormProvider>
  );
};
