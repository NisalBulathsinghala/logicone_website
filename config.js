// ============================================================
// Logic One SA — Dashboard Configuration
// ============================================================
// Edit the values below then redeploy to update the connection.
// This file is protected by the same edge function as dashboard.html
// so it is never served to unauthenticated visitors.
// ============================================================

window.LO_CONFIG = {

  // Google Sheet ID — from the URL:
  // docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
  sheetId: '1LO6BKQGtFiTPRyvg-KWLXmpEKCpARqRFabyIlCmc_n8',

  // The exact name of the tab in your sheet
  // (check the tab at the bottom of Google Sheets)
  sheetTab: 'Form Responses 1',

  // Google Sheets API Key — from Google Cloud Console
  // console.cloud.google.com → APIs & Services → Credentials
  apiKey: 'AIzaSyDAyn-oXbiwVYUgG1EpEZwqWCAK7247RBQ',

  // Apps Script Web App URL — from your deployed Apps Script
  // Extensions → Apps Script → Deploy → Manage deployments → copy URL
  appsScriptUrl: 'https://script.google.com/macros/library/d/1UjtgCRMjDNdzH-h95QPJSeE_DmfB8e3URFxaG3BzS9vxcerBpBjjLWst/4',

};
