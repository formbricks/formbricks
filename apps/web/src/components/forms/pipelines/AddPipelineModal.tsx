"use client";

/* This example requires Tailwind CSS v2.0+ */
import Modal from "@/components/Modal";
import { createPipeline, usePipelines } from "@/lib/pipelines";
import { Button } from "@formbricks/ui";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { emailNotification } from "./emailNotification";
import PipelineSettings from "./PipelineSettings";
import { slackNotification } from "./slackNotification";
import { webhook } from "./webhook";

const availablePipelines = [webhook, emailNotification, slackNotification];

const getEmptyPipeline = () => {
  return { label: "", type: null, events: ["submissionFinished"], config: {} };
};

export default function AddPipelineModal({ open, setOpen }) {
  const router = useRouter();
  const [typeId, setTypeId] = useState(null);
  const [pipeline, setPipeline] = useState(getEmptyPipeline());
  const { pipelines, mutatePipelines } = usePipelines(
    router.query.formId?.toString(),
    router.query.workspaceId?.toString()
  );

  useEffect(() => {
    if (typeId !== pipeline.type) {
      setPipeline({ ...pipeline, type: typeId });
    }
  }, [typeId, pipeline]);

  useEffect(() => {
    if (!open) {
      setPipeline(getEmptyPipeline());
      setTypeId(null);
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newPipeline = await createPipeline(
      router.query.formId?.toString(),
      router.query.workspaceId?.toString(),
      pipeline
    );
    const newPipelines = JSON.parse(JSON.stringify(pipelines));
    newPipelines.push(newPipeline);
    mutatePipelines(newPipelines);
    setOpen(false);
  };

  return (
    <Modal open={open} setOpen={setOpen}>
      <>
        {typeId === null ? (
          <>
            <h2 className="text-ui-gray-dark mb-6 text-xl font-bold">
              Please choose a pipeline you want to add
            </h2>
            {availablePipelines.map((pipeline) => (
              <div
                className="border-ui-gray-light mb-5 w-full border bg-white shadow sm:rounded"
                key={pipeline.title}>
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">{pipeline.title}</h3>
                  <div className="mt-2 sm:flex sm:items-start sm:justify-between">
                    <div className="max-w-xl text-sm text-gray-500">
                      <p>{pipeline.description}</p>
                    </div>
                    <div className="mt-5 sm:mt-0 sm:ml-6 sm:flex sm:flex-shrink-0 sm:items-center">
                      <Button
                        onClick={() => {
                          setTypeId(pipeline.typeId);
                        }}>
                        Select
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <form className="w-full space-y-8 divide-y divide-gray-200" onSubmit={handleSubmit}>
            <PipelineSettings typeId={typeId} pipeline={pipeline} setPipeline={setPipeline} />
            <div className="pt-5">
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="ml-2">
                  Create
                </Button>
              </div>
            </div>
          </form>
        )}
      </>
    </Modal>
  );
}
