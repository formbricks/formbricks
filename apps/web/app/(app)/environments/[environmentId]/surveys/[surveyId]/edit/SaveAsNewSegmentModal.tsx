"use client";

import {
  createUserSegmentAction,
  updateUserSegmentAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { useSurvey } from "@/lib/surveys/surveys";
import { Survey } from "@formbricks/types/surveys";
import { Button, Dialog, DialogContent, Input } from "@formbricks/ui";
import React from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";

type SaveAsNewSegmentModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  localSurvey: Survey;
};

type SaveAsNewSegmentModalForm = {
  title: string;
  description: string;
};

const SaveAsNewSegmentModal: React.FC<SaveAsNewSegmentModalProps> = ({ open, setOpen, localSurvey }) => {
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<SaveAsNewSegmentModalForm>();

  const { mutateSurvey } = useSurvey(localSurvey.environmentId, localSurvey.id);

  const handleSaveSegment: SubmitHandler<SaveAsNewSegmentModalForm> = async (data) => {
    if (!localSurvey.userSegment?.filters || !localSurvey.userSegment?.filters.length) return;

    try {
      // if the segment is private, update it to add title, description and make it public
      // otherwise, create a new segment

      if (!!localSurvey.userSegment && localSurvey.userSegment?.isPrivate) {
        await updateUserSegmentAction(localSurvey.userSegment.id, {
          title: data.title,
          description: data.description,
          isPrivate: false,
          filters: localSurvey.userSegment?.filters,
        });

        toast.success("Segment updated successfully");
        mutateSurvey();
        setOpen(false);
        return;
      }

      await createUserSegmentAction({
        environmentId: localSurvey.environmentId,
        surveyId: localSurvey.id,
        title: data.title,
        description: data.description,
        isPrivate: true,
        filters: localSurvey.userSegment?.filters,
      });

      toast.success("Segment created successfully");
      mutateSurvey();
      setOpen(false);
    } catch (err) {
      console.log(err);
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm bg-slate-50 p-8 sm:max-w-md">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(handleSaveSegment)}>
          <h3 className="text-base font-semibold text-slate-900">New Segment</h3>

          <p className="font-medium text-slate-500">
            Save Segments to target the same Segment in other surveys.
          </p>

          <div className="flex flex-col gap-4">
            <Input
              {...register("title", {
                required: {
                  value: true,
                  message: "Title is required",
                },
              })}
              type="text"
              placeholder="Title"
              className="w-full rounded-xl border-2 border-slate-700 p-2"
            />
            {errors?.title?.message && <p className="text-xs text-red-500">{errors?.title?.message}</p>}
            <Input
              {...register("description", {
                required: {
                  value: true,
                  message: "Description is required",
                },
              })}
              type="text"
              placeholder="Description"
              className="w-full rounded-xl border-2 border-slate-700 p-2"
            />
            {errors?.title?.message && <p className="text-xs text-red-500">{errors?.title?.message}</p>}
          </div>

          <div className="flex w-full gap-4">
            <Button variant="minimal" size="sm" className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-slate-300" />
              <span className="text-sm text-slate-500">Save</span>
            </Button>

            <Button
              type="button"
              variant="minimal"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setOpen(false)}>
              <div className="h-4 w-4 rounded-full bg-slate-300" />
              <span className="text-sm text-slate-500">Discard</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SaveAsNewSegmentModal;
