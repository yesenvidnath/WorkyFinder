let tokenClient;
let gapiInited = false;
let gisInited = false;
let hoursChart = null; // Add this to track the chart instance

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
        prompt: '',
        ux_mode: 'popup'
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

    // Get number of days in the month
    const daysInMonth = endDate.getDate();

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
        
        // Initialize daily hours object
        const dailyHours = {};
        for (let i = 1; i <= daysInMonth; i++) {
            dailyHours[i] = 0;
        }

        events.forEach(event => {
            if (event.start.dateTime && event.end.dateTime) {
                const start = new Date(event.start.dateTime);
                const end = new Date(event.end.dateTime);
                const duration = (end - start) / (1000 * 60);
                totalMinutes += duration;

                // Add to daily total
                const day = start.getDate();
                dailyHours[day] += duration / 60; // Convert to hours

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
            `${totalHours}h ${remainingMinutes}m`;

        // Update table
        const breakdownHtml = eventBreakdown.map(event => 
            `<tr>
                <td>${event.date}</td>
                <td>${event.title}</td>
                <td>${Math.floor(event.duration / 60)}h ${Math.round(event.duration % 60)}m</td>
            </tr>`
        ).join('');

        document.getElementById('events-breakdown').innerHTML = breakdownHtml;

        // Create chart
        createDailyChart(dailyHours, daysInMonth);

    } catch (err) {
        console.error('Error calculating hours:', err);
        alert('Error calculating hours. Please try again.');
    }
}

function createDailyChart(dailyHours, daysInMonth) {
    const ctx = document.getElementById('hoursChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (hoursChart) {
        hoursChart.destroy();
    }

    // Prepare data for chart
    const labels = [];
    const data = [];
    
    for (let i = 1; i <= daysInMonth; i++) {
        labels.push(i.toString());
        data.push(dailyHours[i].toFixed(2));
    }

    hoursChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Hours',
                data: data,
                backgroundColor: '#2563eb',
                borderRadius: 4,
                barThickness: 'flex'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#0f172a',
                    padding: 12,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    cornerRadius: 6,
                    callbacks: {
                        label: function(context) {
                            const hours = Math.floor(context.parsed.y);
                            const minutes = Math.round((context.parsed.y - hours) * 60);
                            return `${hours}h ${minutes}m`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#e2e8f0'
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            size: 11
                        }
                    },
                    title: {
                        display: true,
                        text: 'Hours',
                        color: '#64748b',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            size: 11
                        },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 15
                    },
                    title: {
                        display: true,
                        text: 'Day of Month',
                        color: '#64748b',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                }
            }
        }
    });
}