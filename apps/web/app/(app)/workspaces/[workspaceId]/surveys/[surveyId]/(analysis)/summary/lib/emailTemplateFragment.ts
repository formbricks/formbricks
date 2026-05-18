const EMAIL_DOCTYPE_PATTERN = /<!DOCTYPE[^>]*>/i;
const EMAIL_BODY_PATTERN = /<body\b[^>]*>([\s\S]*?)<\/body>/i;
const EMAIL_REACT_SERVER_MARKER_PATTERN = /<!--\/?\$-->/g;

export const extractEmailBodyFragment = (html: string): string => {
  const htmlWithoutDoctype = html.replace(EMAIL_DOCTYPE_PATTERN, "").trim();
  const bodyMatch = EMAIL_BODY_PATTERN.exec(htmlWithoutDoctype);
  const fragment = bodyMatch?.[1].trim() ?? htmlWithoutDoctype;

  return fragment.replaceAll(EMAIL_REACT_SERVER_MARKER_PATTERN, "").trim();
};
