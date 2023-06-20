/**
 * @jest-environment jsdom
 */
import formbricks from "../src/index";
import { constants } from "./constants"
import { Attribute } from "./types";
import { mockEventTrackResponse, mockInitResponse, mockLogoutResponse, mockRefreshResponse, mockRegisterRouteChangeResponse, mockSetCustomAttributeResponse, mockSetEmailIdResponse, mockSetUserIdResponse, mockUpdateEmailResponse } from "./__mocks__/apiMock";

const logSpy = jest.spyOn(global.console, "log");

test("Test Jest", () => {
    expect(1 + 9).toBe(10);
});

const { environmentId, apiHost, initialUserId, initialUserEmail, updatedUserEmail, customAttributeKey, customAttributeValue } = constants

beforeEach(() => {
    fetchMock.resetMocks();
});

test("Formbricks should Initialise", async () => {
    mockInitResponse()

    await formbricks.init({
        environmentId,
        apiHost,
        logLevel: "debug",
    });

    const configFromBrowser = localStorage.getItem("formbricksConfig");
    expect(configFromBrowser).toBeTruthy();

    if (configFromBrowser) {
        const jsonSavedConfig = JSON.parse(configFromBrowser);
        expect(jsonSavedConfig.environmentId).toStrictEqual(environmentId);
        expect(jsonSavedConfig.apiHost).toStrictEqual(apiHost);
    }
});

test("Formbricks should get no current person", () => {
    const currentState = formbricks.getPerson()

    const currentStateAttributes: Array<Attribute> = currentState.attributes as Array<Attribute>;
    expect(currentStateAttributes).toHaveLength(0)
})

test("Formbricks should set attributes", async () => {
    mockSetUserIdResponse()
    await formbricks.setUserId(initialUserId)

    mockSetEmailIdResponse()
    await formbricks.setEmail(initialUserEmail)

    mockSetCustomAttributeResponse()
    await formbricks.setAttribute(customAttributeKey, customAttributeValue)

    const currentState = formbricks.getPerson()
    expect(currentState.environmentId).toStrictEqual(environmentId)

    const currentStateAttributes: Array<Attribute> = currentState.attributes as Array<Attribute>;

    const numberOfUserAttributes = currentStateAttributes.length
    expect(numberOfUserAttributes).toStrictEqual(3)

    currentStateAttributes.forEach((attribute) => {
        switch (attribute.attributeClass.name) {
            case "userId":
                expect(attribute.value).toStrictEqual(initialUserId)
                break;
            case "email":
                expect(attribute.value).toStrictEqual(initialUserEmail)
                break;
            case customAttributeKey:
                expect(attribute.value).toStrictEqual(customAttributeValue)
                break;
            default:
                expect(0).toStrictEqual(1)
        }
    })
})

test("Formbricks should update attribute", async () => {
    mockUpdateEmailResponse()
    await formbricks.setEmail(updatedUserEmail)

    const currentState = formbricks.getPerson()
    expect(currentState.environmentId).toStrictEqual(environmentId)

    const currentStateAttributes: Array<Attribute> = currentState.attributes as Array<Attribute>;

    const numberOfUserAttributes = currentStateAttributes.length
    expect(numberOfUserAttributes).toStrictEqual(3)

    currentStateAttributes.forEach((attribute) => {
        switch (attribute.attributeClass.name) {
            case "email":
                expect(attribute.value).toStrictEqual(updatedUserEmail)
                break;
            case "userId":
                expect(attribute.value).toStrictEqual(initialUserId)
                break;
            case customAttributeKey:
                expect(attribute.value).toStrictEqual(customAttributeValue)
                break;
            default:
                expect(0).toStrictEqual(1)
        }
    })
})

test("Formbricks should track event", async () => {
    mockEventTrackResponse()
    const mockButton = document.createElement("button");
    mockButton.addEventListener("click", async () => {
        await formbricks.track("Button Clicked");
    });
    await mockButton.click();
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Formbricks: Event "Button Clicked" tracked/));
});

test("Formbricks should refresh", async () => {
    mockRefreshResponse()
    await formbricks.refresh()
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Settings refreshed/));
})

test("Formbricks should register for route change", async () => {
    mockRegisterRouteChangeResponse()
    await formbricks.registerRouteChange()
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Checking page url/));
})

test("Formbricks should logout", async () => {
    mockLogoutResponse()
    await formbricks.logout()
    const currentState = formbricks.getPerson()
    const currentStateAttributes: Array<Attribute> = currentState.attributes as Array<Attribute>;

    expect(currentState.environmentId).toStrictEqual(environmentId)
    expect(currentStateAttributes.length).toBe(0)
})
