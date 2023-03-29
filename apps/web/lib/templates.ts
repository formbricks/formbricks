import { Template } from "@/../../packages/types/templates";

// replace all occurences of productName with the actual product name in the current template
export const replacePresetPlaceholders = (template: Template, product: any) => {
  const preset = JSON.parse(JSON.stringify(template.preset));
  preset.name = preset.name.replace("{{productName}}", product.name);
  preset.questions.forEach((question) => {
    question.headline = question.headline.replace("{{productName}}", product.name);
    question.subheader = question.subheader?.replace("{{productName}}", product.name);
  });
  return { ...template, preset };
};
