/**
 * JSON for an AI prompt's data block, with every `<` escaped (`\u003c`, which JSON reads back as `<`),
 * so text from a file cannot close the block it sits in and pass itself off as instructions, whatever
 * it says. Every import lane builds its data block with this.
 */
export const promptDataJson = (value: unknown): string =>
  JSON.stringify(value).replaceAll("<", String.raw`\u003c`);
