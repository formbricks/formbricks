export interface Display {
  id: string;
  createdAt: string;
  updatedAt: string;
  surveyId: string;
  personId?: string;
  status: "seen" | "responded";
}
