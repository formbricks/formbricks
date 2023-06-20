import fetchMock from "jest-fetch-mock";
import { constants } from "../constants"

const { environmentId, apiHost, initialPersonUid, initialUserId, initialUserEmail, newPersonUid, eventIdForRouteChange, updatedUserEmail, customAttributeKey, customAttributeValue, eventIdForEventTracking, userIdAttributeId, userInitialEmailAttributeId, userCustomAttrAttributeId, userUpdatedEmailAttributeId } = constants

export const mockInitResponse = () => {
    fetchMock.mockResponseOnce(JSON.stringify({
        apiHost,
        environmentId,
        person: {
            id: initialPersonUid,
            environmentId,
            attributes: []
        },
        session: {},
        settings: {
            surveys: [],
            noCodeEvents: [],
        }
    }));
}

export const mockSetUserIdResponse = () => {
    fetchMock.mockResponseOnce(JSON.stringify({
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
                        name: "userId"
                    }
                }
            ]
        }
    }));
}

export const mockSetEmailIdResponse = () => {
    fetchMock.mockResponseOnce(JSON.stringify({
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
                        name: "userId"
                    }
                },
                {
                    id: userInitialEmailAttributeId,
                    value: initialUserEmail,
                    attributeClass: {
                        id: environmentId,
                        name: "email"
                    }
                }
            ]
        },
    }));
}

export const mockSetCustomAttributeResponse = () => {
    fetchMock.mockResponseOnce(JSON.stringify({
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
                        name: "userId"
                    }
                },
                {
                    id: userInitialEmailAttributeId,
                    value: initialUserEmail,
                    attributeClass: {
                        id: environmentId,
                        name: "email"
                    }
                },
                {
                    id: userCustomAttrAttributeId,
                    value: customAttributeValue,
                    attributeClass: {
                        id: environmentId,
                        name: customAttributeKey
                    }
                }

            ]
        },
    }));
}

export const mockUpdateEmailResponse = () => {
    fetchMock.mockResponseOnce(JSON.stringify({
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
                        name: "userId"
                    }
                },
                {
                    id: userUpdatedEmailAttributeId,
                    value: updatedUserEmail,
                    attributeClass: {
                        id: environmentId,
                        name: "email"
                    }
                },
                {
                    id: userCustomAttrAttributeId,
                    value: customAttributeValue,
                    attributeClass: {
                        id: environmentId,
                        name: customAttributeKey
                    }
                }

            ]
        },
    }));
}

export const mockEventTrackResponse = () => {
    fetchMock.mockResponseOnce(JSON.stringify({
        id: eventIdForEventTracking,
    }));
}

export const mockRefreshResponse = () => {
    fetchMock.mockResponseOnce(JSON.stringify({}));
}

export const mockRegisterRouteChangeResponse = () => {
    fetchMock.mockResponseOnce(JSON.stringify({
        id: eventIdForRouteChange,
    }));
}

export const mockLogoutResponse = () => {
    fetchMock.mockResponseOnce(JSON.stringify({
        settings: {
            surveys: [],
            noCodeEvents: [],
        },
        person: {
            id: newPersonUid,
            environmentId,
            attributes: []
        },
        session: {},
    }));
}