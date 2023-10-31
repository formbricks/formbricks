import { TPipelineTrigger } from "@formbricks/types/pipelines";

export const triggers = [
  { title: "Response Created", value: "responseCreated" as TPipelineTrigger },
  { title: "Response Updated", value: "responseUpdated" as TPipelineTrigger },
  { title: "Response Finished", value: "responseFinished" as TPipelineTrigger },
];
