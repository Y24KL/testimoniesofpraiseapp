/**
 * Expo config plugin: packages only 64-bit ARM native code.
 *
 * expo-build-properties limits React Native's own libraries to arm64-v8a. Some third-party libraries (for example
 * the ML Kit barcode library) also ship 32-bit code. abiFilters removes it from every library, which keeps the APK
 * within the size target. 32-bit-only phones cannot install a build made with this plugin.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('abiFilters')) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /defaultConfig \{/,
        "defaultConfig {\n        ndk {\n            abiFilters 'arm64-v8a'\n        }",
      );
    }
    return mod;
  });
