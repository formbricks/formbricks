/**
 * The Custom CSS field's Tidy button (ENG-3723): Prettier's CSS printer, imported on first use so the
 * styling pages only load it when someone asks for it. Rejects when Prettier cannot parse the CSS; the
 * caller then leaves the field as it was.
 */
export const tidyCss = async (source: string): Promise<string> => {
  if (source.trim() === "") return source;
  const [{ format }, postcss] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/postcss"),
  ]);
  const formatted = await format(source, { parser: "css", plugins: [postcss], printWidth: 100 });
  // Prettier ends the file with a newline, which the gutter would number as an empty last line.
  return formatted.trimEnd();
};
