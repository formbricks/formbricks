/**
 * What the creatives list shows for a link Destination: its host, plus the path when the link goes below
 * the site's root, so a link to another site's home page still says where it goes. The full URL stays in
 * the cell's tooltip.
 */
export const getLinkTargetLabel = (url: string): string => {
  try {
    const { host, pathname } = new URL(url);
    return pathname === "/" ? host : `${host}${pathname}`;
  } catch {
    return url;
  }
};
