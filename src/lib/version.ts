import packageJson from "../../package.json";

/**
 * The single source of truth for the running application version.
 *
 * `package.json` is the canonical value: the release pipeline (release-please)
 * bumps it, and every surface derives from this module instead of repeating a
 * literal. Previously `/api/health` and `/api/openapi.json` hard-coded
 * `"1.0.0"` while `package.json` said `1.1.1`, so the deployed Worker
 * advertised a version that had never been released.
 *
 * Importing the JSON keeps a single edit point: bumping `package.json` (or
 * merging the release PR that does it) updates the API, the OpenAPI document
 * and anything else that reads `APP_VERSION`.
 */
export const APP_VERSION: string = packageJson.version;

/** Product name used in API payloads and documents. */
export const APP_NAME = "FormForge";

/** `v1.2.3` — the tag format used by releases. */
export const APP_VERSION_TAG = `v${APP_VERSION}`;
