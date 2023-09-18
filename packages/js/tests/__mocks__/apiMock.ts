import fetchMock from "jest-fetch-mock";
import { constants } from "../constants";

const {
  environmentId,
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
} = constants;

export const mockInitResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      data: {
        person: {
          id: initialPersonUid,
          createdAt: "2021-03-09T15:00:00.000Z",
          updatedAt: "2021-03-09T15:00:00.000Z",
          attributes: {},
        },
        session: {
          id: sessionId,
          createdAt: "2021-03-09T15:00:00.000Z",
          updatedAt: "2021-03-09T15:00:00.000Z",
          expiresAt: expiryTime,
        },
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
        noCodeActionClasses: [],
        product: {
          noCodeEvents: [],
          brandColor: "#20b398",
          formbricksSignature: true,
          placement: "bottomRight",
          darkOverlay: false,
          clickOutsideClose: true,
        },
      },
    })
  );
};

export const mockSetUserIdResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      data: {
        surveys: [],
        session: {
          id: sessionId,
          createdAt: "2021-03-09T15:00:00.000Z",
          updatedAt: "2021-03-09T15:00:00.000Z",
          expiresAt: expiryTime,
        },
        noCodeActionClasses: [],
        person: {
          id: initialPersonUid,
          environmentId,
          attributes: { userId: initialUserId },
        },
      },
    })
  );
};

export const mockSetEmailIdResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      data: {
        surveys: [],
        session: {
          id: sessionId,
          createdAt: "2021-03-09T15:00:00.000Z",
          updatedAt: "2021-03-09T15:00:00.000Z",
          expiresAt: expiryTime,
        },
        noCodeActionClasses: [],
        person: {
          id: initialPersonUid,
          environmentId,
          attributes: { userId: initialUserId, email: initialUserEmail },
        },
      },
    })
  );
};

export const mockSetCustomAttributeResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      data: {
        surveys: [],
        session: {
          id: sessionId,
          createdAt: "2021-03-09T15:00:00.000Z",
          updatedAt: "2021-03-09T15:00:00.000Z",
          expiresAt: expiryTime,
        },
        noCodeActionClasses: [],
        person: {
          id: initialPersonUid,
          environmentId,
          attributes: {
            userId: initialUserId,
            email: initialUserEmail,
            [customAttributeKey]: customAttributeValue,
          },
        },
      },
    })
  );
};

export const mockUpdateEmailResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      data: {
        surveys: [],
        noCodeActionClasses: [],
        session: {
          id: sessionId,
          createdAt: "2021-03-09T15:00:00.000Z",
          updatedAt: "2021-03-09T15:00:00.000Z",
          expiresAt: expiryTime,
        },
        person: {
          id: initialPersonUid,
          environmentId,
          attributes: {
            userId: initialUserId,
            email: updatedUserEmail,
            [customAttributeKey]: customAttributeValue,
          },
        },
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

export const mockResetResponse = () => {
  fetchMock.mockResponseOnce(
    JSON.stringify({
      data: {
        settings: {
          surveys: [],
          noCodeEvents: [],
        },
        person: {
          id: newPersonUid,
          environmentId,
          attributes: [],
        },
        session: {
          id: sessionId,
          createdAt: "2021-03-09T15:00:00.000Z",
          updatedAt: "2021-03-09T15:00:00.000Z",
          expiresAt: expiryTime,
        },
        noCodeActionClasses: [],
      },
    })
  );
  console.log("Resetting person. Getting new person, session and settings from backend");
};
