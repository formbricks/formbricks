/**
 * Where the web app loads the survey renderer from (link surveys). `/js/*` is cached at the CDN for up
 * to 30 days, so an unversioned URL keeps serving the previous release's renderer after a deploy until
 * someone purges it — and with it, whatever that renderer does not send yet, such as the creative that
 * opened the survey (ENG-4001). A `?v=` per release makes each release a new URL, like js-core's
 * content-hash URL (ENG-3992). Without a release version (development, self-built) it stays unversioned.
 */
export const getSurveysScriptUrl = (
  appUrl: string | undefined,
  releaseVersion: string | undefined
): string => {
  const url = `${appUrl ?? ""}/js/surveys.umd.cjs`;
  return releaseVersion ? `${url}?v=${encodeURIComponent(releaseVersion)}` : url;
};
