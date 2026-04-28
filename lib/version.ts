/**
 * Application version string, sourced from package.json.
 * Bundled at build time — no runtime fs access.
 */
import packageJson from "../package.json";

export const APP_VERSION = packageJson.version;
