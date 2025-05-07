import { AlchemySigner } from "@account-kit/core";
import { getRecorder, sendTransaction } from "@wonderchain/sdk";
import objectHash from "object-hash";
import { Provider } from "zksync-ethers";
import { TResponseData, TResponseUpdate } from "@formbricks/types/responses";
import { ApiClient } from "./api-client";
import { SurveyState } from "./survey-state";

interface QueueConfig {
  appUrl: string;
  environmentId: string;
  retryAttempts: number;
  onResponseSendingFailed?: (responseUpdate: TResponseUpdate) => void;
  onResponseSendingFinished?: () => void;
  setSurveyState?: (state: SurveyState) => void;
}

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export class ResponseQueue {
  private queue: TResponseUpdate[] = [];
  private config: QueueConfig;
  private surveyState: SurveyState;
  private isRequestInProgress = false;
  private api: ApiClient;
  private provider: Provider;
  private signer: AlchemySigner;
  private response: TResponseData = {};

  constructor(config: QueueConfig, surveyState: SurveyState, provider: Provider, signer?: AlchemySigner) {
    this.config = config;
    this.surveyState = surveyState;
    this.api = new ApiClient({
      appUrl: config.appUrl,
      environmentId: config.environmentId,
    });
    this.provider = provider;
    if (signer) {
      this.signer = signer;
    }
  }

  add(responseUpdate: TResponseUpdate) {
    // update survey state
    this.surveyState.accumulateResponse(responseUpdate);
    if (this.config.setSurveyState) {
      this.config.setSurveyState(this.surveyState);
    }
    // add response to queue
    this.queue.push(responseUpdate);
    this.processQueue();
  }

  async processQueue() {
    if (this.isRequestInProgress) return;
    if (this.queue.length === 0) return;

    this.isRequestInProgress = true;

    const responseUpdate = this.queue[0];
    let attempts = 0;

    // console.log("add().responseUpdate", responseUpdate);

    while (attempts < this.config.retryAttempts) {
      const success = await this.sendResponse(responseUpdate);
      if (success) {
        this.queue.shift(); // remove the successfully sent response from the queue
        break; // exit the retry loop
      }
      console.error(`Formbricks: Failed to send response. Retrying... ${attempts}`);
      await delay(1000); // wait for 1 second before retrying
      attempts++;
    }

    if (attempts >= this.config.retryAttempts) {
      // Inform the user after 2 failed attempts
      console.error("Failed to send response after 2 attempts.");
      // If the response fails finally, inform the user
      if (this.config.onResponseSendingFailed) {
        this.config.onResponseSendingFailed(responseUpdate);
      }
      this.isRequestInProgress = false;
    } else {
      if (responseUpdate.finished && this.config.onResponseSendingFinished) {
        this.config.onResponseSendingFinished();
      }
      this.isRequestInProgress = false;
      this.processQueue(); // process the next item in the queue if any
    }
  }

  /** 
   responseUpdate example
    {
      "data": {
          "djew2zxpd9zonx3jkh03qz3s": [
              "T8",
              "T8",
              "8000",
              "{\"transactionHash\":\"0x172b753b199c1bbb94d3385d6f164b06788c3af3c8151c3e92ebe290f324317c\"}"
          ]
      },
      "ttc": {
          "djew2zxpd9zonx3jkh03qz3s": 13383.5
      },
      "finished": true,
      "meta": {
          "url": "http://localhost:3000/s/cma1bsx490003vx3rtx4j8cbl"
      },
      "variables": {},
      "displayId": "cmad05oab000fvx9jvw48iwv2",
      "hiddenFields": {
          "verifiedEmail": "vexadeh133@javbing.com",
          "verifiedAddress": "0xe06361aD485f09C7918DdF607F3FC5aFD91e2512"
      }
    }
    **/
  async sendResponse(responseUpdate: TResponseUpdate): Promise<boolean> {
    try {
      if (!responseUpdate.hiddenFields) {
        responseUpdate.hiddenFields = {};
      }

      this.response = {
        ...this.response,
        ...responseUpdate.data,
        ...responseUpdate.hiddenFields,
      };

      // console.log("this.response", this.response);
      /** this.response example
      { "djew2zxpd9zonx3jkh03qz3s": [
          "T2",
          "T2",
          "1000",
          "{\"transactionHash\":\"0xbc77ced5f6f1482ac498ee2b0a77456a833621498e100377452907a26469d04e\"}"
          ],
        "verifiedEmail": "vexadeh133@javbing.com",
        "verifiedAddress": "0xe06361aD485f09C7918DdF607F3FC5aFD91e2512"
      }
       */

      let existingTransactionHash = this.response["transactionHash"];

      if (!existingTransactionHash) {
        for (const key in this.response) {
          const value = this.response[key];

          if (Array.isArray(value) && value.length > 3) {
            const txDetailsString = value[3];

            if (txDetailsString.includes("transactionHash")) {
              try {
                const parsed = JSON.parse(txDetailsString);
                // console.log("JSON parsed txDetailsString", parsed);
                if (parsed && parsed.transactionHash) {
                  existingTransactionHash = parsed.transactionHash;

                  // update this.response
                  this.response["transactionHash"] = parsed.transactionHash;
                  break;
                }
              } catch (e) {
                console.log(`Error parsing transaction detail string`, e);
              }
            }
          }
        }
      }

      if (responseUpdate.finished && this.signer && !existingTransactionHash) {
        const recorder = await getRecorder(this.provider);
        if (recorder) {
          delete this.response["dataHash"];
          delete this.response["transactionHash"];
          console.log("hashing", this.response);
          const hash = objectHash(this.response);
          const input = await recorder.record.populateTransaction(hash);

          input.from = await this.signer.getAddress();
          input.value = BigInt(0);

          const resp = await sendTransaction(this.provider, input, this.signer.signTypedData);
          if (resp.hash) {
            responseUpdate.data["dataHash"] = hash;
            responseUpdate.data["transactionHash"] = resp.hash;
          }
        }
      }

      if (this.surveyState.responseId !== null) {
        await this.api.updateResponse({ ...responseUpdate, responseId: this.surveyState.responseId });
      } else {
        const response = await this.api.createResponse({
          ...responseUpdate,
          surveyId: this.surveyState.surveyId,
          contactId: this.surveyState.contactId || null,
          userId: this.surveyState.userId || null,
          singleUseId: this.surveyState.singleUseId || null,
          data: { ...responseUpdate.data, ...responseUpdate.hiddenFields },
          displayId: this.surveyState.displayId,
        });

        if (!response.ok) {
          throw new Error("Could not create response");
        }

        this.surveyState.updateResponseId(response.data.id);
        if (this.config.setSurveyState) {
          this.config.setSurveyState(this.surveyState);
        }
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  // update surveyState
  updateSurveyState(surveyState: SurveyState) {
    this.surveyState = surveyState;
  }
}
