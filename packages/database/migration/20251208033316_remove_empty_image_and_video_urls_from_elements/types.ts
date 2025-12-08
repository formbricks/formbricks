export interface SurveyElement {
  id: string;
  imageUrl?: string;
  videoUrl?: string;
}
export interface Block {
  id: string;
  elements: SurveyElement[];
}

export interface SurveyRecord {
  id: string;
  blocks: Block[];
  welcomeCard: {
    fileUrl?: string;
    videoUrl?: string;
  };
  endings: {
    imageUrl?: string;
    videoUrl?: string;
  }[];
}
