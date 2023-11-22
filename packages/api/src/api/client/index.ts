import { ResponseAPI } from "./response";
import { DisplayAPI } from "./display";
import { ApiConfig } from "../../types";
import { ActionAPI } from "./action";
import { PeopleAPI } from "./people";

export class Client {
  response: ResponseAPI;
  display: DisplayAPI;
  action: ActionAPI;
  people: PeopleAPI;

  constructor(options: ApiConfig) {
    const { apiHost, environmentId } = options;

    this.response = new ResponseAPI(apiHost, environmentId);
    this.display = new DisplayAPI(apiHost, environmentId);
    this.action = new ActionAPI(apiHost, environmentId);
    this.people = new PeopleAPI(apiHost, environmentId);
  }
}
