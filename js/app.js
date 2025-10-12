let tokenClient;
let gapiInited = false;
let gisInited = false;

document.addEventListener('DOMContentLoaded', initializeGoogleAPI);

function initializeGoogleAPI() {
    gapi.load('client', initializeGapiClient);
    loadGIS();
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC]
        });
        gapiInited = true;
        maybeEnableButtons();
    } catch (err) {
        console.error('Error initializing GAPI client:', err);
    }
}

function loadGIS() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse,
        prompt: '', // Remove 'consent' from here
        ux_mode: 'popup'
        // REMOVED: hosted_domain - this was causing the error
        // REMOVED: enable_serial_consent - not needed for basic auth
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize-button').style.visibility = 'visible';
    }
}

async function handleAuthClick() {
    try {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
        console.error('Error getting auth token:', err);
    }
}

async function handleTokenResponse(response) {
    if (response.error !== undefined) {
        console.error('Auth error:', response);
        alert('Authentication failed. Please try again.');
        return;
    }
    document.getElementById('auth-section').style.display = 'none';
    await listCalendars();
}

async function listCalendars() {
    try {
        const response = await gapi.client.calendar.calendarList.list();
        const calendars = response.result.items;
        const select = document.getElementById('calendar-select');
        select.innerHTML = '<option value="">Select a Calendar</option>';
        
        calendars.forEach(calendar => {
            const option = document.createElement('option');
            option.value = calendar.id;
            option.textContent = calendar.summary;
            select.appendChild(option);
        });

        document.getElementById('calendar-section').style.display = 'block';
    } catch (err) {
        console.error('Error loading calendars:', err);
        alert('Error loading calendars. Please try signing in again.');
    }
}

async function calculateHours() {
    const calendarId = document.getElementById('calendar-select').value;
    const monthPicker = document.getElementById('month-picker').value;
    
    if (!calendarId || !monthPicker) {
        alert('Please select both a calendar and a month');
        return;
    }

    const [year, month] = monthPicker.split('-');
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    try {
        const response = await gapi.client.calendar.events.list({
            'calendarId': calendarId,
            'timeMin': startDate.toISOString(),
            'timeMax': endDate.toISOString(),
            'singleEvents': true,
            'orderBy': 'startTime'
        });

        const events = response.result.items;
        let totalMinutes = 0;
        let eventBreakdown = [];

        events.forEach(event => {
            if (event.start.dateTime && event.end.dateTime) {
                const start = new Date(event.start.dateTime);
                const end = new Date(event.end.dateTime);
                const duration = (end - start) / (1000 * 60);
                totalMinutes += duration;

                eventBreakdown.push({
                    title: event.summary,
                    duration: duration,
                    date: start.toLocaleDateString()
                });
            }
        });

        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = Math.round(totalMinutes % 60);

        document.getElementById('results-section').style.display = 'block';
        document.getElementById('hours-result').innerHTML = 
            `Total Working Hours: ${totalHours} hours and ${remainingMinutes} minutes`;

        const breakdownHtml = eventBreakdown.map(event => 
            `<div class="event-item">
                <strong>${event.date}</strong> - ${event.title}: 
                ${Math.floor(event.duration / 60)}h ${Math.round(event.duration % 60)}m
            </div>`
        ).join('');

        document.getElementById('events-breakdown').innerHTML = breakdownHtml;

    } catch (err) {
        console.error('Error calculating hours:', err);
        alert('Error calculating hours. Please try again.');
    }
}