let gapiInited = false;
let gisInited = false;

document.addEventListener('DOMContentLoaded', initializeGoogleAPI);

function initializeGoogleAPI() {
    gapi.load('client:auth2', async () => {
        try {
            await gapi.client.init({
                apiKey: API_KEY,
                clientId: CLIENT_ID,
                discoveryDocs: [DISCOVERY_DOC],
                scope: SCOPES,
                cookiePolicy: 'single_host_origin'
            });
            gapiInited = true;
            maybeEnableButtons();
        } catch (err) {
            console.error('Error initializing Google API:', err);
            handleError(err);
        }
    });
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            clientId: CLIENT_ID,
            discoveryDocs: [DISCOVERY_DOC],
            scope: SCOPES
        });

        // Check if already signed in
        const authInstance = gapi.auth2.getAuthInstance();
        if (authInstance.isSignedIn.get()) {
            handleSignInSuccess();
        }

        gapiInited = true;
        gisInited = true;
        maybeEnableButtons();
    } catch (err) {
        console.error('Error initializing GAPI client:', err);
        handleError(err);
    }
}

function handleError(err) {
    console.error('Error during authentication:', err);
    document.getElementById('authorize-button').style.display = 'block';
    alert('Authentication error. Please try again.');
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorize-button').style.visibility = 'visible';
    }
}

async function handleAuthClick() {
    try {
        const authInstance = gapi.auth2.getAuthInstance();
        const user = await authInstance.signIn({
            prompt: 'select_account'
        });
        
        if (user) {
            handleSignInSuccess();
        }
    } catch (err) {
        console.error('Error during authentication:', err);
        handleError(err);
    }
}

async function handleSignInSuccess() {
    try {
        document.getElementById('authorize-button').innerText = 'Refresh Authorization';
        await listCalendars();
    } catch (err) {
        console.error('Error after sign-in:', err);
        handleError(err);
    }
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
    const endDate = new Date(year, month, 0); // Last day of selected month

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
                const duration = (end - start) / (1000 * 60); // Duration in minutes
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

        // Display results
        document.getElementById('results-section').style.display = 'block';
        document.getElementById('hours-result').innerHTML = 
            `Total Working Hours: ${totalHours} hours and ${remainingMinutes} minutes`;

        // Display breakdown
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