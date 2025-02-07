export interface TriggerUpdate {
  create?: Array<{ actionClassId: string }>;
  deleteMany?: {
    actionClassId: {
      in: string[];
    };
  };
}
