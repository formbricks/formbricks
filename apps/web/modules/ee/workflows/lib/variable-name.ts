/**
 * How the editor names a Variable: payload Variables by their key (`customer.id`), the way the @
 * picker lists them; `steps.…` and `response.…` keep their prefix so they stay recognisable.
 */
export const getVariableDisplayName = (path: string) => path.replace(/^payload\./, "");
