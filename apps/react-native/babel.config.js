
module.exports = function (api) {
  api.cache(true);
  process.env.EXPO_ROUTER_APP_ROOT = '../../apps/react-native/src/'

  return {
    plugins: [
      // require.resolve('expo-router/babel')
    ],
    presets: ['babel-preset-expo']
  }
};
