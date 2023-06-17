/**
 * @jest-environment jsdom
 */
import formbricks from "../src/index";
import { constants } from "./constants"
import { Attribute } from "./types";

const logSpy = jest.spyOn(global.console, 'log');

test("Test Jest", () => {
    expect(1 + 9).toBe(10);
});

test("Formbricks should Initialise", async () => {
    formbricks.init({
        environmentId: constants.environmentId,
        apiHost: constants.apiHost,
        logLevel: "debug",
    });
    await new Promise((unused) => setTimeout(unused, 2000)); // Need to wait for the init() to fetch and log everything

    const configFromBrowser = localStorage.getItem("formbricksConfig");
    expect(configFromBrowser).toBeTruthy();

    if (configFromBrowser) {
        const jsonSavedConfig = JSON.parse(configFromBrowser);
        expect(jsonSavedConfig.environmentId).toEqual(constants.environmentId);
        expect(jsonSavedConfig.apiHost).toEqual(constants.apiHost);
    }
});

test("Formbricks should get no current person", () => {
    let currentState = formbricks.getPerson()
    if (currentState != undefined) {
        let currentState = formbricks.getPerson()
        const currentStateAttributes: Array<Attribute> = currentState.attributes as Array<Attribute>;
        expect(currentStateAttributes).toHaveLength(0)
    } else {
        expect(currentState).toBeUndefined()
    }
})

test("Formbricks should set attributes", async () => {
    formbricks.setUserId(constants.initialUserId)
    formbricks.setEmail(constants.initialUserEmail)
    await formbricks.setAttribute(constants.customAttributeKey, constants.customAttributeValue)

    let currentState = formbricks.getPerson()
    expect(currentState.environmentId).toEqual(constants.environmentId)

    const currentStateAttributes: Array<Attribute> = currentState.attributes as Array<Attribute>;

    let numberOfUserAttributes = currentStateAttributes.length
    expect(numberOfUserAttributes).toEqual(3)

    currentStateAttributes.forEach((attribute) => {
        switch (attribute.attributeClass.name) {
            case "userId":
                expect(attribute.value).toEqual(constants.initialUserId)
                break;
            case "email":
                expect(attribute.value).toEqual(constants.initialUserEmail)
                break;
            case constants.customAttributeKey:
                expect(attribute.value).toEqual(constants.customAttributeValue)
                break;
            default:
                expect(0).toEqual(1)
        }
    })
})

test("Formbricks should update attribute", async () => {
    await formbricks.setEmail(constants.updatedUserEmail)

    let currentState = formbricks.getPerson()
    expect(currentState.environmentId).toEqual(constants.environmentId)

    const currentStateAttributes: Array<Attribute> = currentState.attributes as Array<Attribute>;

    let numberOfUserAttributes = currentStateAttributes.length
    expect(numberOfUserAttributes).toEqual(3)

    currentStateAttributes.forEach((attribute) => {
        switch (attribute.attributeClass.name) {
            case "email":
                expect(attribute.value).toEqual(constants.updatedUserEmail)
                break;
            case "userId":
                expect(attribute.value).toEqual(constants.initialUserId)
                break;
            case constants.customAttributeKey:
                expect(attribute.value).toEqual(constants.customAttributeValue)
                break;
            default:
                expect(0).toEqual(1)
        }
    })
})

test("Formbricks should track event", async () => {
    const mockButton = document.createElement("button");
    mockButton.addEventListener("click", async () => {
        await formbricks.track("Button Clicked");
    });
    mockButton.click();
    await new Promise((unused) => setTimeout(unused, 1000)); // to wait for the DOM interaction & logging of event tracking to happen

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Formbricks: Event "Button Clicked" tracked/));
});

test("Formbricks should refresh", async () => {
    await formbricks.refresh()
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Settings refreshed/));
})

test("Formbricks should register for route change", async () => {
    await formbricks.registerRouteChange()
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/Checking page url/));
})

test("Formbricks should logout", async () => {
    await formbricks.logout()
    let currentState = formbricks.getPerson()
    const currentStateAttributes: Array<Attribute> = currentState.attributes as Array<Attribute>;

    expect(currentState.environmentId).toEqual(constants.environmentId)
    expect(currentStateAttributes.length).toBe(0)
})
