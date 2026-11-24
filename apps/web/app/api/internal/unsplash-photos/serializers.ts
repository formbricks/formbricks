/** One search result as the editor's image picker shows it. */
export type TUnsplashPhotoResource = {
  id: string;
  alt_description: string | null;
  urls: {
    /** The photo, with the author's name and profile link on it for the attribution the picker shows. */
    regularWithAttribution: string;
    /** Where to report the photo as used (`POST /api/internal/unsplash-photos/downloads`). */
    download: string;
  };
};

/** The fields of an Unsplash search result the picker uses. */
export type TUnsplashSearchResult = {
  id: string;
  alt_description: string | null;
  user: { first_name: string | null; last_name: string | null; links: { html: string } };
  urls: { regular: string };
  links: { download_location: string };
};

export const serializeUnsplashPhoto = (result: TUnsplashSearchResult): TUnsplashPhotoResource => {
  const authorName = encodeURIComponent(
    [result.user.first_name, result.user.last_name].filter((part) => part?.trim()).join(" ")
  );
  const authorLink = encodeURIComponent(result.user.links.html);

  return {
    id: result.id,
    alt_description: result.alt_description,
    urls: {
      regularWithAttribution: `${result.urls.regular}&dpr=2&authorLink=${authorLink}&authorName=${authorName}&utm_source=formbricks&utm_medium=referral`,
      download: result.links.download_location,
    },
  };
};
