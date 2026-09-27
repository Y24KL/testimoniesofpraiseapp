// Keeps the nested admin portal (top-admin/) out of the mobile app's bundler.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  /[\/\\]top-admin[\/\\].*/,
];

module.exports = config;
