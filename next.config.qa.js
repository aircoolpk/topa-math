/**
 * QA-only Next config — identical to next.config.js but with an isolated
 * distDir so parallel dev servers don't corrupt each other's .next cache.
 * Used only by the Visual QA audit; not part of the production build.
 */
const base = require('./next.config.js')

module.exports = {
  ...base,
  distDir: process.env.NEXT_DIST_DIR || '.next-qa',
}
