/** @type {import('jest').Config} */
const config = {
    verbose: true,
    testEnvironment: "jsdom"
};

import fetchMock from "jest-fetch-mock";
fetchMock.enableMocks();

module.exports = config;
