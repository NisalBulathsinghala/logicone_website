// build.js — injects config directly into dashboard.html at build time
// No config.js file needed — values go straight into the protected HTML file
const fs = require('fs');

const SHEETS_ID       = process.env.SHEETS_ID       || '';
const SHEETS_API_KEY  = process.env.SHEETS_API_KEY  || '';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

console.log('Building dashboard with config:');
console.log('  SHEETS_ID:',       SHEETS_ID       ? 'set ✓' : 'MISSING ✗');
console.log('  SHEETS_API_KEY:',  SHEETS_API_KEY  ? 'set ✓' : 'MISSING ✗');
console.log('  APPS_SCRIPT_URL:', APPS_SCRIPT_URL ? 'set ✓' : 'MISSING ✗');

// Read dashboard.html and replace the LO_CONFIG placeholder
let dashboard = fs.readFileSync('dashboard.html', 'utf8');

const configScript = `<script>
window.LO_CONFIG = {
  sheetId:       '${SHEETS_ID}',
  sheetTab:      'Form Responses 1',
  apiKey:        '${SHEETS_API_KEY}',
  appsScriptUrl: '${APPS_SCRIPT_URL}',
};
</script>`;

// Replace the placeholder comment in dashboard.html
dashboard = dashboard.replace('<!-- LO_CONFIG_PLACEHOLDER -->', configScript);

fs.writeFileSync('dashboard.html', dashboard);
console.log('dashboard.html built successfully.');

// Remove config.js from output if it exists (no longer needed)
if (fs.existsSync('config.js')) {
  // Write empty placeholder so edge function has something to protect
  fs.writeFileSync('config.js', '// config managed via build process');
  console.log('config.js cleared.');
}
