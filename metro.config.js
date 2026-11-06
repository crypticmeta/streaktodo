const { getDefaultConfig } = require('expo/metro-config');
const imageSize = require('image-size');

// image-size has unresolved infinite-loop advisories in its ICNS, JXL, and
// HEIF parsers. Metro only receives repository-controlled assets here, and the
// app ships none of these formats, so reject them before dimension parsing.
// Keep this guard until Expo/Metro moves to a patched image-size release.
imageSize.disableTypes(['icns', 'jxl', 'heif']);

module.exports = getDefaultConfig(__dirname);
