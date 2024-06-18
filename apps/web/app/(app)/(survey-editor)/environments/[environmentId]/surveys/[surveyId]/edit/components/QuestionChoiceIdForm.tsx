"use client";

import { FormProvider, UseFormProps, useForm } from "react-hook-form";
import { Button } from "@formbricks/ui/Button";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";

type QuestionChoiceIdFormProps = {
  onSubmit: (data: QuestionChoiceIdForm) => void;
  defaultValues: UseFormProps<QuestionChoiceIdForm>["defaultValues"];
  otherChoiceIds?: string[];
};

type QuestionChoiceIdForm = {
  id: string;
};

export const QuestionChoiceIdForm: React.FC<QuestionChoiceIdFormProps> = ({
  defaultValues,
  onSubmit,
  otherChoiceIds,
}) => {
  const form = useForm<QuestionChoiceIdForm>({
    mode: "onChange",
    defaultValues: defaultValues,
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, isValid, isDirty },
  } = form;

  const disabled = isSubmitting || !(isValid && isDirty);

  return (
    <div className="space-y-2 p-4">
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid w-full ">
            <div className="col-span-1">
              <FormField
                control={control}
                name="id"
                rules={{
                  required: true,
                  validate: (value) => {
                    if (otherChoiceIds?.includes(value)) {
                      return "Choice ID already used";
                    }
                    return true;
                  },
                }}
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel htmlFor="id">Customize choice ID</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        id="id"
                        {...field}
                        placeholder="custom choiche ID"
                        isInvalid={!!error?.message}
                      />
                    </FormControl>

                    <FormError />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex w-full justify-between  py-4 ">
            <Button disabled={disabled} variant="darkCTA" size="sm" type="submit" loading={isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
