/**
 * @jest-environment jsdom
 */
import formbricks from "../src/index";
import { constants } from "./constants"

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