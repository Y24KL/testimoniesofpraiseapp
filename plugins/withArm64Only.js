/**
 * Expo config plugin: packages only 64-bit ARM native code.
 *
 * expo-build-properties limits React Native's own libraries to arm64-v8a. Some third-party libraries (for example
 * the ML Kit barcode library) also ship 32-bit code. Two Gradle settings remove it:
 *   - ndk.abiFilters limits the ABIs the app is built for.
 *   - splits.abi (with universalApk false) packages only the arm64-v8a APK, so no 32-bit libraries are packed.
 * 32-bit-only phones cannot install a build made with this plugin.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const SPLITS = `    splits {
        abi {
            enable true
            reset()
            include 'arm64-v8a'
            universalApk false
        }
    }
`;

module.exports = (config) =>
  withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    if (!contents.includes('abiFilters')) {
      contents = contents.replace(
        /defaultConfig \{/,
        "defaultConfig {\n        ndk {\n            abiFilters 'arm64-v8a'\n        }",
      );
    }
    if (!contents.includes('universalApk false')) {
      contents = contents.replace(/\n    defaultConfig \{/, `\n${SPLITS}    defaultConfig {`);
    }
    mod.modResults.contents = contents;
    return mod;
  });
