// Run with: node scratch/refresh-puter-token.js
// Opens your browser to log into Puter and prints a fresh PUTER_AUTH_TOKEN.
// PUTER_AUTH_TOKEN is a browser session token (JWT type "gui"), not a stable
// API key, so it periodically expires and needs to be re-minted this way.
const { getAuthToken } = require("@heyputer/puter.js/src/init.cjs");

(async () => {
  console.log("Opening browser to log into Puter...");
  const token = await getAuthToken();
  console.log("\nFresh PUTER_AUTH_TOKEN:\n");
  console.log(token);
  console.log("\nUpdate this in .env.local and in the Vercel project's env vars.");
  process.exit(0);
})();
