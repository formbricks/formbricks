import { InvalidInputError } from "@formbricks/types/errors";

/**
 * Another quota on the survey already has this name (`@@unique([surveyId, name])`). Still an
 * `InvalidInputError`, as before, but typed, so a route answers 409 without parsing the message.
 */
export class QuotaNameTakenError extends InvalidInputError {
  constructor() {
    super("Quota with this name already exists");
    this.name = "QuotaNameTakenError";
  }
}
