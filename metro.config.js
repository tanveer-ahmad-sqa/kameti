// Sentry's Expo config wraps the default Expo Metro config (adds debug IDs for source maps).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

module.exports = getSentryExpoConfig(__dirname);
