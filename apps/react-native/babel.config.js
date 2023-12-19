// eslint-disable-next-line turbo/no-undeclared-env-vars
process.env.EXPO_ROUTER_APP_ROOT = '../../apps/react-native/src/'

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo']
  }
};
