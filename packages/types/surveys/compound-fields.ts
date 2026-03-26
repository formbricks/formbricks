// Sub-field definitions for compound question types (ContactInfo, Address).
// Field order matches the array storage format used in response data.

export const CONTACT_INFO_FIELDS = ["firstName", "lastName", "email", "phone", "company"] as const;
export const ADDRESS_FIELDS = [
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "country",
] as const;

export type TContactInfoField = (typeof CONTACT_INFO_FIELDS)[number];
export type TAddressField = (typeof ADDRESS_FIELDS)[number];

export const COMPOUND_FIELD_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  addressLine1: "Address Line 1",
  addressLine2: "Address Line 2",
  city: "City",
  state: "State",
  zip: "Zip",
  country: "Country",
};

// Combined index lookup — field names are globally unique across compound types,
// so we can resolve sub-field values without knowing the element type.
export const ALL_COMPOUND_FIELD_INDICES: Record<string, number> = {
  // ContactInfo fields
  firstName: 0,
  lastName: 1,
  email: 2,
  phone: 3,
  company: 4,
  // Address fields
  addressLine1: 0,
  addressLine2: 1,
  city: 2,
  state: 3,
  zip: 4,
  country: 5,
};

export function getCompoundFields(elementType: string): readonly string[] | null {
  if (elementType === "contactInfo") return CONTACT_INFO_FIELDS;
  if (elementType === "address") return ADDRESS_FIELDS;
  return null;
}
