import fetchMock from "jest-fetch-mock";
import { constants } from "../constants";

const {
  environmentId,
  apiHost,
  sessionId,
  expiryTime,
  surveyId,
  questionOneId,
  questionTwoId,
  choiceOneId,
  choiceTwoId,
  choiceThreeId,
  initialPersonUid,
  initialUserId,
  initialUserEmail,
  newPersonUid,
  eventIdForRouteChange,
  updatedUserEmail,
  customAttributeKey,
  customAttributeValue,
  eventIdForEventTracking,
  userIdAttributeId,
  userInitialEmailAttributeId,
  userCustomAttrAttributeId,
  userUpdatedEmailAttributeId,
} = constants;

export const mockInitResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      apiHost,
      environmentId,
      person: {
        id: initialPersonUid,
        environmentId,
        attributes: [],
      },
      session: {
        id: sessionId,
        expiresAt: expiryTime,
      },
      settings: {
        surveys: [
          {
            id: surveyId,
            questions: [
              {
                id: questionOneId,
                type: "multipleChoiceSingle",
                choices: [
                  {
                    id: choiceOneId,
                    label: "Not at all disappointed",
                  },
                  {
                    id: choiceTwoId,
                    label: "Somewhat disappointed",
                  },
                  {
                    id: choiceThreeId,
                    label: "Very disappointed",
                  },
                ],
                headline: "How disappointed would you be if you could no longer use Test-Formbricks?",
                required: true,
                subheader: "Please select one of the following options:",
              },
              {
                id: questionTwoId,
                type: "openText",
                headline: "How can we improve Test-Formbricks for you?",
                required: true,
                subheader: "Please be as specific as possible.",
              },
            ],
            triggers: [],
            thankYouCard: {
              enabled: true,
              headline: "Thank you!",
              subheader: "We appreciate your feedback.",
            },
            autoClose: null,
            delay: 0,
          },
        ],
        noCodeEvents: [],
        brandColor: "#20b398",
        formbricksSignature: true,
        placement: "bottomRight",
        darkOverlay: false,
        clickOutsideClose: true,
      },
    })
  );
};

export const mockSetUserIdResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      apiHost,
      environmentId,
      settings: {
        surveys: [],
        noCodeEvents: [],
      },
      person: {
        id: initialPersonUid,
        environmentId,
        attributes: [
          {
            id: userIdAttributeId,
            value: initialUserId,
            attributeClass: {
              id: environmentId,
              name: "userId",
            },
          },
        ],
      },
    })
  );
};

export const mockSetEmailIdResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      apiHost,
      environmentId,
      settings: {
        surveys: [],
        noCodeEvents: [],
      },
      person: {
        id: initialPersonUid,
        environmentId,
        attributes: [
          {
            id: userIdAttributeId,
            value: initialUserId,
            attributeClass: {
              id: environmentId,
              name: "userId",
            },
          },
          {
            id: userInitialEmailAttributeId,
            value: initialUserEmail,
            attributeClass: {
              id: environmentId,
              name: "email",
            },
          },
        ],
      },
    })
  );
};

export const mockSetCustomAttributeResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      apiHost,
      environmentId,
      settings: {
        surveys: [],
        noCodeEvents: [],
      },
      person: {
        id: initialPersonUid,
        environmentId,
        attributes: [
          {
            id: userIdAttributeId,
            value: initialUserId,
            attributeClass: {
              id: environmentId,
              name: "userId",
            },
          },
          {
            id: userInitialEmailAttributeId,
            value: initialUserEmail,
            attributeClass: {
              id: environmentId,
              name: "email",
            },
          },
          {
            id: userCustomAttrAttributeId,
            value: customAttributeValue,
            attributeClass: {
              id: environmentId,
              name: customAttributeKey,
            },
          },
        ],
      },
    })
  );
};

export const mockUpdateEmailResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      apiHost,
      environmentId,
      settings: {
        surveys: [],
        noCodeEvents: [],
      },
      person: {
        id: initialPersonUid,
        environmentId,
        attributes: [
          {
            id: userIdAttributeId,
            value: initialUserId,
            attributeClass: {
              id: environmentId,
              name: "userId",
            },
          },
          {
            id: userUpdatedEmailAttributeId,
            value: updatedUserEmail,
            attributeClass: {
              id: environmentId,
              name: "email",
            },
          },
          {
            id: userCustomAttrAttributeId,
            value: customAttributeValue,
            attributeClass: {
              id: environmentId,
              name: customAttributeKey,
            },
          },
        ],
      },
    })
  );
};

export const mockEventTrackResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      id: eventIdForEventTracking,
    })
  );
  console.log('Formbricks: Event "Button Clicked" tracked');
};

export const mockRefreshResponse = () => {
  fetchMock.mockResponseOnce(JSON.stringify({}));
  console.log("Settings refreshed");
};

export const mockRegisterRouteChangeResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      id: eventIdForRouteChange,
    })
  );
  console.log("Checking page url: http://localhost/");
};

export const mockLogoutResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      settings: {
        surveys: [],
        noCodeEvents: [],
      },
      person: {
        id: newPersonUid,
        environmentId,
        attributes: [],
      },
      session: {},
    })
  );
  console.log("Resetting person. Getting new person, session and settings from backend");
};
