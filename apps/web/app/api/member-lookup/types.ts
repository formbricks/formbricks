/**
 * Member data structure returned by the API
 * Customize these fields based on your Snowflake schema
 */
export type TMemberData = {
  recordNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  organization?: string;
  department?: string;
  membershipLevel: string;
  membershipStatus: string;
  joinDate: string;
  renewalDate?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

/**
 * API Response types
 */
export type TMemberLookupSuccessResponse = {
  success: true;
  data: TMemberData;
};

export type TMemberLookupErrorResponse = {
  success: false;
  error: string;
  message?: string;
};

export type TMemberLookupResponse = TMemberLookupSuccessResponse | TMemberLookupErrorResponse;
