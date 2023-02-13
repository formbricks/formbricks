import { FormbricksConfig } from ".";

export class FormbricksError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "FormbricksError";
  }
}

export class InvalidConfigError extends FormbricksError {
  property: keyof FormbricksConfig;

  constructor(property: keyof FormbricksConfig) {
    super(`Missing/invalid property on config: ${property}`);
    this.name = "InvalidConfigError";
    this.property = property;
  }
}
