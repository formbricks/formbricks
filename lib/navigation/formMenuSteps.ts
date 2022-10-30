export const useFormMenuSteps = (formId) => [
  {
    id: "form",
    name: "Formulaire",
    href: `/forms/${formId}/form`,
  },
  {
    id: "pipelines",
    name: "Pipelines",
    href: `/forms/${formId}/pipelines`,
  },
  {
    id: "results",
    name: "Résultats",
    href: `/forms/${formId}/results/summary`,
  },
];
