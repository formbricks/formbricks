/* This example requires Tailwind CSS v2.0+ */
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { createPipeline, usePipelines } from "../../lib/pipelines";
import Modal from "../Modal";
import { webhook, WebhookSettings } from "./webhook";

const availablePipelines = [webhook];

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
            <h2 className="mb-6 text-xl font-bold text-ui-gray-dark">
              Please choose a pipeline you want to add
            </h2>
            {availablePipelines.map((pipeline) => (
              <div
                className="w-full bg-white border shadow border-ui-gray-light sm:rounded"
                key={pipeline.title}
              >
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    {pipeline.title}
                  </h3>
                  <div className="mt-2 sm:flex sm:items-start sm:justify-between">
                    <div className="max-w-xl text-sm text-gray-500">
                      <p>{pipeline.description}</p>
                    </div>
                    <div className="mt-5 sm:mt-0 sm:ml-6 sm:flex-shrink-0 sm:flex sm:items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setTypeId(pipeline.typeId);
                        }}
                        className="inline-flex items-center px-4 py-2 font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <form
            className="w-full space-y-8 divide-y divide-gray-200"
            onSubmit={handleSubmit}
          >
            {typeId === "WEBHOOK" ? (
              <WebhookSettings pipeline={pipeline} setPipeline={setPipeline} />
            ) : null}
            <div className="pt-5">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center px-4 py-2 ml-3 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
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
