import { ApiConfig } from "./types/index";
import { Client } from "./api/client";

export class FormbricksAPI {
  client: Client;

  constructor(options: ApiConfig) {
    this.client = new Client(options);
  }
}
