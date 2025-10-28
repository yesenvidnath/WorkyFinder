// Configuration values for Google APIs.
// These default values are provided as fallbacks but will be overridden
// if a `.env` file is present at the project root when served.
let CLIENT_ID = '326493887178-t7aa6mtoa029uvcierqtjrtjb2k5gdu6.apps.googleusercontent.com';
let API_KEY = 'AIzaSyBOsa3UY8X-6d4tXAMSf2luIQTUJtU8G0c';
let DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
let SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

// Also expose DISCOVERY_DOC_URL for compatibility with existing code
let DISCOVERY_DOC_URL = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Try to load overrides from /.env (served from the project root).
// Format expects KEY=VALUE per line. Lines starting with # are ignored.
async function loadEnvFile() {
	try {
		const res = await fetch('/.env');
		if (!res.ok) {
			// No env file found; keep defaults
			return;
		}
		const text = await res.text();
		const lines = text.split(/\r?\n/);
		for (const raw of lines) {
			const line = raw.trim();
			if (!line || line.startsWith('#')) continue;
			const idx = line.indexOf('=');
			if (idx === -1) continue;
			const key = line.slice(0, idx).trim();
			// Allow values with = in them by joining the rest
			const value = line.slice(idx + 1).trim();
			switch (key) {
				case 'CLIENT_ID':
					CLIENT_ID = value;
					break;
				case 'API_KEY':
					API_KEY = value;
					break;
				case 'DISCOVERY_DOC':
					DISCOVERY_DOC = value;
					break;
				case 'DISCOVERY_DOC_URL':
					DISCOVERY_DOC_URL = value;
					break;
				case 'SCOPES':
					SCOPES = value;
					break;
				default:
					// ignore unknown keys
					break;
			}
		}
	} catch (err) {
		// Fetch failed (likely running file:// or blocked). Keep defaults.
		console.warn('Could not load /.env — using default config values.', err);
	}
}

// Start loading immediately (non-blocking). Other scripts that depend on
// these values should either wait for this script to finish or tolerate
// the fallback values. `js/app.js` calls to Google APIs will generally be
// executed after this file loads in the browser because `index.html`
// includes it before `app.js`.
loadEnvFile();