/**
 * @jest-environment jsdom
 */
import formbricks from "../src/index";
import { constants } from "./constants"
import { Attribute } from "./types";

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