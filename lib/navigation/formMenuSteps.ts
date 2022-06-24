export const useFormMenuSteps = (formId) => [
  {
    id: "form",
    name: "Form",
    href: `/forms/${formId}/form`,
  },
  {
    id: "pipelines",
    name: "Pipelines",
    href: `/forms/${formId}/pipelines`,
  },
  {
    id: "results",
    name: "Results",
    href: `/forms/${formId}/results/summary`,
  },
];
