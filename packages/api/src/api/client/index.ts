import { type ApiConfig } from "../../types";
import { AttributeAPI } from "./attribute";
import { DisplayAPI } from "./display";
import { PeopleAPI } from "./people";
import { ResponseAPI } from "./response";
import { StorageAPI } from "./storage";

export class Client {
  response: ResponseAPI;
  display: DisplayAPI;
  people: PeopleAPI;
  storage: StorageAPI;
  attribute: AttributeAPI;

  constructor(options: ApiConfig) {
    const { apiHost, environmentId } = options;

    this.response = new ResponseAPI(apiHost, environmentId);
    this.display = new DisplayAPI(apiHost, environmentId);
    this.people = new PeopleAPI(apiHost, environmentId);
    this.attribute = new AttributeAPI(apiHost, environmentId);
    this.storage = new StorageAPI(apiHost, environmentId);
  }
}
