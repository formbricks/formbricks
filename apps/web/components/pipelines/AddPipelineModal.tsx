/* This example requires Tailwind CSS v2.0+ */
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { createPipeline, usePipelines } from "../../lib/pipelines";
import Modal from "../Modal";
import { webhook } from "./webhook";
import { emailNotification } from "./emailNotification";
import PipelineSettings from "./PipelineSettings";

const availablePipelines = [webhook, emailNotification];

const getEmptyPipeline = () => {
  return { name: "", type: null, events: [], data: {} };
};

export default function AddPipelineModal({ open, setOpen }) {
  const router = useRouter();
  const formId = router.query.id.toString();
  const [typeId, setTypeId] = useState(null);
  const [pipeline, setPipeline] = useState(getEmptyPipeline());
  const { pipelines, mutatePipelines } = usePipelines(formId);

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
    const newPipeline = await createPipeline(router.query.id, pipeline);
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
                      <button
                        type="button"
                        onClick={() => {
                          setTypeId(pipeline.typeId);
                        }}
                        className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:text-sm">
                        Select
                      </button>
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
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                  Create
                </button>
              </div>
            </div>
          </form>
        )}
      </>
    </Modal>
  );
}
