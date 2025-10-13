let tokenClient;
let gapiInited = false;
let gisInited = false;
let hoursChart = null;
let currentReportData = null; // Store data for PDF generation

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

                const day = start.getDate();
                dailyHours[day] += duration / 60;

                eventBreakdown.push({
                    title: event.summary,
                    duration: duration,
                    date: start.toLocaleDateString(),
                    day: day
                });
            }
        });

        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = Math.round(totalMinutes % 60);

        // Store data for PDF generation
        const calendarName = document.getElementById('calendar-select').selectedOptions[0].text;
        const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        currentReportData = {
            calendarName: calendarName,
            monthName: monthName,
            totalHours: totalHours,
            totalMinutes: remainingMinutes,
            eventBreakdown: eventBreakdown,
            dailyHours: dailyHours,
            daysInMonth: daysInMonth
        };

        document.getElementById('results-section').style.display = 'block';
        document.getElementById('hours-result').innerHTML = 
            `${totalHours}h ${remainingMinutes}m`;

        const breakdownHtml = eventBreakdown.map(event => 
            `<tr>
                <td>${event.date}</td>
                <td>${event.title}</td>
                <td>${Math.floor(event.duration / 60)}h ${Math.round(event.duration % 60)}m</td>
            </tr>`
        ).join('');

        document.getElementById('events-breakdown').innerHTML = breakdownHtml;

        createDailyChart(dailyHours, daysInMonth);

    } catch (err) {
        console.error('Error calculating hours:', err);
        alert('Error calculating hours. Please try again.');
    }
}

function createDailyChart(dailyHours, daysInMonth) {
    const ctx = document.getElementById('hoursChart').getContext('2d');
    
    if (hoursChart) {
        hoursChart.destroy();
    }

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

async function generatePDF() {
    if (!currentReportData) {
        alert('Please calculate hours first before generating a report');
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Header
    pdf.setFillColor(37, 99, 235);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    pdf.text('WorkyFinder', margin, 20);
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text('Working Hours Report', margin, 30);

    yPosition = 55;

    // Report Info
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('Calendar:', margin, yPosition);
    pdf.setFont(undefined, 'normal');
    pdf.text(currentReportData.calendarName, margin + 30, yPosition);
    
    yPosition += 7;
    pdf.setFont(undefined, 'bold');
    pdf.text('Period:', margin, yPosition);
    pdf.setFont(undefined, 'normal');
    pdf.text(currentReportData.monthName, margin + 30, yPosition);
    
    yPosition += 7;
    pdf.setFont(undefined, 'bold');
    pdf.text('Generated:', margin, yPosition);
    pdf.setFont(undefined, 'normal');
    pdf.text(new Date().toLocaleDateString(), margin + 30, yPosition);

    yPosition += 15;

    // Total Hours Box
    pdf.setFillColor(37, 99, 235);
    pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 25, 3, 3, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('TOTAL WORKING HOURS', pageWidth / 2, yPosition + 10, { align: 'center' });
    
    pdf.setFontSize(20);
    const totalHoursText = `${currentReportData.totalHours}h ${currentReportData.totalMinutes}m`;
    pdf.text(totalHoursText, pageWidth / 2, yPosition + 20, { align: 'center' });

    yPosition += 35;

    // Capture chart as image
    try {
        const chartCanvas = document.getElementById('hoursChart');
        const chartImage = chartCanvas.toDataURL('image/png');
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.text('Daily Distribution', margin, yPosition);
        yPosition += 5;
        
        const chartWidth = pageWidth - 2 * margin;
        const chartHeight = 60;
        pdf.addImage(chartImage, 'PNG', margin, yPosition, chartWidth, chartHeight);
        yPosition += chartHeight + 10;

    } catch (err) {
        console.error('Error capturing chart:', err);
    }

    // Events Table
    if (yPosition + 40 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('Events Breakdown', margin, yPosition);
    yPosition += 8;

    // Table Header
    pdf.setFillColor(248, 250, 252);
    pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
    
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(71, 85, 105);
    pdf.text('DATE', margin + 2, yPosition + 5);
    pdf.text('EVENT', margin + 40, yPosition + 5);
    pdf.text('DURATION', pageWidth - margin - 25, yPosition + 5);
    
    yPosition += 10;

    // Table Rows
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(9);
    
    currentReportData.eventBreakdown.forEach((event, index) => {
        if (yPosition > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
        }

        const duration = `${Math.floor(event.duration / 60)}h ${Math.round(event.duration % 60)}m`;
        
        pdf.text(event.date, margin + 2, yPosition);
        
        // Truncate long event names
        let eventName = event.title;
        if (eventName.length > 40) {
            eventName = eventName.substring(0, 37) + '...';
        }
        pdf.text(eventName, margin + 40, yPosition);
        pdf.text(duration, pageWidth - margin - 25, yPosition);
        
        yPosition += 7;
    });

    // Footer
    const footerY = pageHeight - 15;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Generated by WorkyFinder', pageWidth / 2, footerY, { align: 'center' });
    pdf.text(`Page 1 of ${pdf.internal.getNumberOfPages()}`, pageWidth / 2, footerY + 5, { align: 'center' });

    // Save PDF
    const fileName = `WorkingHours_${currentReportData.monthName.replace(' ', '_')}.pdf`;
    pdf.save(fileName);
}