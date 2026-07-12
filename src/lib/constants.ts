// Shared client+server constants — no server-only imports (node:crypto etc.)
// allowed here, since this file is bundled for the browser too.

/** Every new or reset account starts on this one shared password; the owner
 * must change it (mustChangePassword) before doing anything else. */
export const INITIAL_PASSWORD = "shtroodle-2026";
