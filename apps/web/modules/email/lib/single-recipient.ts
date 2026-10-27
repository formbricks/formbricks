import addressparser from "nodemailer/lib/addressparser";

const MAX_ADDRESS_LENGTH = 320;

/**
 * One plain address, read the way nodemailer will read it: no list, no group, no display name, no angle
 * brackets. Parsed rather than matched against an address regex, so a valid internationalized address still
 * gets through, and the address is not compared to the input: the parser normalizes forms nodemailer still
 * delivers to that one inbox (a quoted local part, a trailing comma).
 *
 * nodemailer reads `to` as an address list, so without this a single invite, costing one unit of the invite
 * budget, reaches several inboxes (ENG-6658).
 */
export const isSingleRecipient = (to: string): boolean => {
  // Bounded before parsing: some callers pass a visitor's input straight through.
  if (to.length > MAX_ADDRESS_LENGTH) return false;
  // A display-name wrapper is not a bare address, and nodemailer reads `<a@x>` as one.
  if (to.includes("<") || to.includes(">")) return false;
  // Exactly one `@` outside a quoted local part: `a@b@x.com` parses as a single address but is not one.
  let atSigns = 0;
  let quoted = false;
  for (let index = 0; index < to.length; index++) {
    const character = to[index];
    if (quoted && character === "\\") {
      index++;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === "@" && !quoted) atSigns++;
  }
  if (quoted || atSigns !== 1) return false;

  const parsed = addressparser(to);
  if (parsed.length !== 1) return false;
  const [entry] = parsed;
  return !("group" in entry) && entry.name === "";
};
