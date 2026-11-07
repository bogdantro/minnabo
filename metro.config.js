const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `npm run test-login` sets this. Every other bundle, store builds included, is the plain config.
module.exports = process.env.MINNABO_TEST_LOGIN === '1' ? require('./dev/test-login/metro')(config) : config;
