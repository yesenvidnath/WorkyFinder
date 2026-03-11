// Google Calendar API credentials
// Set these in .env.local for local development
// For GitHub Pages: Use GitHub Secrets and GitHub Actions to inject these

const CLIENT_ID = window.__CONFIG__?.CLIENT_ID || '132463630327-f8r9nco0l5ff1dnoqlugrjdcl4u2sdrs.apps.googleusercontent.com';  
const API_KEY = window.__CONFIG__?.API_KEY || 'AIzaSyCgJxg8GVeA5YYyEtiJDHJnzLJX2JV7FJM';       
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC_URL = DISCOVERY_DOC;
