/**
 * @jest-environment jsdom
 */
import formbricks from "../src/index";
import { constants } from "./constants"
import { Attribute } from "./types";

const logSpy = jest.spyOn(global.console, "log");

test("Test Jest", () => {
    expect(1 + 9).toBe(10);
});

const { environmentId, apiHost, initialUserId, initialUserEmail, updatedUserEmail, customAttributeKey, customAttributeValue } = constants

test("Formbricks should Initialise", async () => {
    formbricks.init({
        environmentId,
        apiHost,
        logLevel: "debug",
    });
    await new Promise((unused) => setTimeout(unused, 2000)); // Need to wait for the init() to fetch and log everything

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
    if (currentState != undefined) {
        const currentStateAttributes: Array<Attribute> = currentState.attributes as Array<Attribute>;
        expect(currentStateAttributes).toHaveLength(0)
    } else {
        expect(currentState).toBeUndefined()
    }
})

test("Formbricks should set attributes", async () => {
    formbricks.setUserId(initialUserId)
    formbricks.setEmail(initialUserEmail)
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
    const currentState = formbricks.getPerson()
    const currentStateAttributes: Array<Attribute> = currentState.attributes as Array<Attribute>;

    expect(currentState.environmentId).toStrictEqual(environmentId)
    expect(currentStateAttributes.length).toBe(0)
})
