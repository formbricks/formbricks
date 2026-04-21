import { MERGE_FIELDS, type TMergeField } from "../types/invitation";

type Vars = Partial<Record<TMergeField, string | null | undefined>>;

// Substitutes `{{fieldName}}` merge tokens in a user-authored body.
// Unknown tokens are preserved as-is (not silently removed) so authoring
// typos are visible to the sender. Values are NOT HTML-escaped here
// because the email template renders the body as plain text (the
// InvitationEmail component uses CSS `whitespace: pre-wrap` to preserve
// newlines without injecting raw HTML).
export function renderTemplate(body: string, vars: Vars): string {
  return body.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, rawKey: string) => {
    const key = rawKey as TMergeField;
    if (!MERGE_FIELDS.includes(key)) return match;
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

// Subject line runs through the same substitution.
export const renderSubject = renderTemplate;
