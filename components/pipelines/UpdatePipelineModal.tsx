import {
  persistPipeline,
  usePipeline,
  usePipelines,
} from "../../lib/pipelines";
import Loading from "../Loading";
import Modal from "../Modal";
import { WebhookSettings } from "./webhook";
import { AirtableSettings } from "./airtable";

export default function UpdatePipelineModal({
  open,
  setOpen,
  formId,
  pipelineId,
}) {
  const { pipeline, isLoadingPipeline, mutatePipeline } = usePipeline(
    formId,
    pipelineId
  );
  const { pipelines, mutatePipelines } = usePipelines(formId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await persistPipeline(pipeline);
    const newPipelines = JSON.parse(JSON.stringify(pipelines));
    const pipelineIdx = pipelines.findIndex((p) => p.id === pipelineId);
    if (pipelineIdx > -1) {
      newPipelines[pipelineIdx] = pipeline;
      mutatePipelines(newPipelines);
    }
    setOpen(false);
  };

  return (
    <Modal open={open} setOpen={setOpen}>
      {isLoadingPipeline ? (
        <Loading />
      ) : (
        <form
          className="w-full space-y-8 divide-y divide-gray-200"
          onSubmit={handleSubmit}
        >
          {pipeline.type === "WEBHOOK" ? (
            <WebhookSettings
              pipeline={pipeline}
              setPipeline={(p) => mutatePipeline(p, false)}
            />
          ) : null}
          {pipeline.type === "AIRTABLE" ? (
            <AirtableSettings
              pipeline={pipeline}
              setPipeline={(p) => mutatePipeline(p, false)}
            />
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
                Update
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
