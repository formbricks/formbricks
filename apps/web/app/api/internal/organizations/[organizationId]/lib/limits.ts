/**
 * Longest image URL a whitelabel setting (the email logo, the favicon) may store: an uploaded file's
 * storage path or an absolute URL. Far above any upload's URL, and still small enough that no request
 * stores a megabyte of text in the organization row.
 */
export const WHITELABEL_IMAGE_URL_MAX_LENGTH = 4096;
