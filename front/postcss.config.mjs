/******************************** postcss.config.mjs ***************************************
 *
 *  Module: Postcss.Config
 *
 *  This module configures the Next.js and Capacitor frontend application.
 *
 *  The module provides:
 *
 *  - tooling or runtime configuration for the frontend.
 *  - settings consumed by build, lint, or mobile sync commands.
 *
 *  Key Structures Used:
 *
 *  - configuration objects, plugin settings, or shared declarations.
 *
 *  This module ensures:
 *
 *  - frontend tooling reads settings from one checked-in location.
 *  - local and deployment builds use the same defaults.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
