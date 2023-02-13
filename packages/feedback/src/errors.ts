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

export class NetworkError extends FormbricksError {
  statusCode: number;
  url: string;

  constructor(status: number, url: string, message?: string) {
    super(`Network Error (${status}), ${url}: ${message}`);
    this.name = "NetworkError";
    this.statusCode = status;
    this.url = url;
  }
}
