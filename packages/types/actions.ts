export interface Action {
  id: string;
  createdAt: string;
  updatedAt: string;
  eventClassId: string;
  sessionId: string;
  properties: { [key: string]: string };
}
