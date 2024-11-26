import { Client } from "./api/client";
import { type ApiConfig } from "./types/index";

export class FormbricksAPI {
  client: Client;

  constructor(options: ApiConfig) {
    this.client = new Client(options);
  }
}
