import { Metadata } from "next";
import { getTranslate } from "@/lingodotdev/server";

/**
 * Browser tab title for a settings page: pass the same translation key the page renders as its
 * heading, so the tab and the sidebar always say the same thing. Titles have to resolve per request
 * because they are translated, which a static `metadata` object cannot do.
 *
 * Each settings page names itself rather than inheriting one title for the whole section. The
 * section-wide title this replaced still said "Configuration" long after the UI stopped using that
 * word anywhere — and it reached the product docs from there.
 */
export const getSettingsPageMetadata = async (headingKey: string): Promise<Metadata> => {
  const t = await getTranslate();
  return { title: t(headingKey) };
};
