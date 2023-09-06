"use client";

import {
  createUserSegmentAction,
  updateUserSegmentAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import Modal from "@/components/shared/Modal";
import { useSurvey } from "@/lib/surveys/surveys";
import { Survey } from "@formbricks/types/surveys";
import { TUserSegment } from "@formbricks/types/v1/userSegment";
import { Button, Input } from "@formbricks/ui";
import { UserGroupIcon } from "@heroicons/react/24/solid";
import React from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";

type SaveAsNewSegmentModalProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  localSurvey: Survey;
  userSegment: TUserSegment;
};

type SaveAsNewSegmentModalForm = {
  title: string;
  description: string;
};

const SaveAsNewSegmentModal: React.FC<SaveAsNewSegmentModalProps> = ({
  open,
  setOpen,
  localSurvey,
  userSegment,
}) => {
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<SaveAsNewSegmentModalForm>();

  const { mutateSurvey } = useSurvey(localSurvey.environmentId, localSurvey.id);

  const handleSaveSegment: SubmitHandler<SaveAsNewSegmentModalForm> = async (data) => {
    if (!userSegment || !userSegment?.filters.length) return;

    try {
      // if the segment is private, update it to add title, description and make it public
      // otherwise, create a new segment

      if (!!userSegment && userSegment?.isPrivate) {
        await updateUserSegmentAction(userSegment.id, {
          title: data.title,
          description: data.description,
          isPrivate: false,
          filters: userSegment?.filters,
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
        isPrivate: false,
        filters: userSegment?.filters,
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
    <Modal open={open} setOpen={setOpen} noPadding>
      <div className="rounded-t-lg bg-slate-100">
        <div className="flex w-full items-center gap-4 p-6">
          <div className="flex items-center space-x-2">
            <div className="mr-1.5 h-6 w-6 text-slate-500">
              <UserGroupIcon />
            </div>
            <div>
              <h3 className="text-base font-medium">Save as new segment</h3>
              <p className="text-sm text-slate-600">
                Save your filters as a Segment to use it in other surveys
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-lg bg-white">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(handleSaveSegment)}>
          <div className="p-6">
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="title" className="text-sm font-medium text-slate-700">
                  Name
                </label>

                <Input
                  {...register("title", {
                    required: {
                      value: true,
                      message: "Name is required",
                    },
                  })}
                  type="text"
                  placeholder="Name e.g. Power Users"
                  className="w-full p-2"
                />
                {errors?.title?.message && <p className="text-xs text-red-500">{errors?.title?.message}</p>}
              </div>

              <div>
                <label htmlFor="description" className="text-sm font-medium text-slate-700">
                  Description
                </label>
                <Input
                  {...register("description", {
                    required: {
                      value: true,
                      message: "Description is required",
                    },
                  })}
                  type="text"
                  placeholder="Most active users in the last 30 days"
                  className="w-full p-2"
                />
                {errors?.title?.message && <p className="text-xs text-red-500">{errors?.title?.message}</p>}
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="minimal"
                onClick={() => {
                  setOpen(false);
                }}>
                Cancel
              </Button>
              <Button variant="darkCTA" type="submit">
                Save
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default SaveAsNewSegmentModal;
