// build.js — runs at Netlify build time
// Reads environment variables and injects them into config.js
const fs = require('fs');

const SHEETS_ID       = process.env.SHEETS_ID       || '';
const SHEETS_API_KEY  = process.env.SHEETS_API_KEY  || '';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

if (!SHEETS_ID || !SHEETS_API_KEY || !APPS_SCRIPT_URL) {
  console.warn('Warning: one or more environment variables are missing.');
  console.warn('SHEETS_ID:', SHEETS_ID ? 'set' : 'MISSING');
  console.warn('SHEETS_API_KEY:', SHEETS_API_KEY ? 'set' : 'MISSING');
  console.warn('APPS_SCRIPT_URL:', APPS_SCRIPT_URL ? 'set' : 'MISSING');
}

let config = fs.readFileSync('config.js', 'utf8');
config = config
  .replace('%%SHEETS_ID%%',       SHEETS_ID)
  .replace('%%SHEETS_API_KEY%%',  SHEETS_API_KEY)
  .replace('%%APPS_SCRIPT_URL%%', APPS_SCRIPT_URL);

fs.writeFileSync('config.js', config);
console.log('config.js built successfully.');
