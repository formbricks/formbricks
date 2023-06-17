/** @type {import('jest').Config} */
const config = {
    verbose: true,
    testEnvironment: 'jsdom'

};
import 'regenerator-runtime/runtime'
import fetch from 'isomorphic-fetch'

global.fetch = fetch;

module.exports = config;
