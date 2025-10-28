let tokenClient;
let gapiInited = false;
let gisInited = false;
let hoursChart = null;
let currentReportData = null;

document.addEventListener('DOMContentLoaded', initializeGoogleAPI);

function initializeGoogleAPI() {
    gapi.load('client', initializeGapiClient);
    loadGIS();
    setupEventListeners();
}

function setupEventListeners() {
    // Calculate button
    const calculateBtn = document.getElementById('calculate-button');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', calculateHours);
    }
    
    // PDF button
    const pdfBtn = document.getElementById('pdf-button');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', generatePDF);
    }
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
        showError('Error initializing Google API. Please check your API credentials in config.js');
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
        const authButton = document.getElementById('authorize-button');
        authButton.style.visibility = 'visible';
        authButton.addEventListener('click', handleAuthClick);
    }
}

async function handleAuthClick() {
    try {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
        console.error('Error getting auth token:', err);
        showError('Authentication failed. Please try again.');
    }
}

async function handleTokenResponse(response) {
    if (response.error !== undefined) {
        console.error('Auth error:', response);
        showError('Authentication failed. Please try again.');
        return;
    }
    
    // Hide hero section with fade out
    const authSection = document.getElementById('auth-section');
    authSection.style.opacity = '0';
    authSection.style.transition = 'opacity 0.5s ease-out';
    
    setTimeout(() => {
        authSection.style.display = 'none';
        document.getElementById('features').style.display = 'block';
        document.getElementById('dashboard-section').style.display = 'block';
        
        // Smooth scroll to dashboard
        setTimeout(() => {
            document.getElementById('dashboard-section').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }, 500);
    
    await listCalendars();
}

async function listCalendars() {
    try {
        const response = await gapi.client.calendar.calendarList.list();
        const calendars = response.result.items;
        const select = document.getElementById('calendar-select');
        select.innerHTML = '<option value="">Choose your calendar...</option>';
        
        calendars.forEach(calendar => {
            const option = document.createElement('option');
            option.value = calendar.id;
            option.textContent = calendar.summary;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Error loading calendars:', err);
        showError('Error loading calendars. Please try signing in again.');
    }
}

async function calculateHours() {
    const calendarId = document.getElementById('calendar-select').value;
    const monthPicker = document.getElementById('month-picker').value;
    
    if (!calendarId || !monthPicker) {
        showError('Please select both a calendar and a month');
        return;
    }

    // Show loading state
    const calculateBtn = document.getElementById('calculate-button');
    const originalContent = calculateBtn.innerHTML;
    calculateBtn.disabled = true;
    calculateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Calculating...';

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
                    date: start.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                    }),
                    day: day
                });
            }
        });

        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = Math.round(totalMinutes % 60);

        // Store data for PDF generation
        const calendarName = document.getElementById('calendar-select').selectedOptions[0].text;
        const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
        
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
        
        // Animate the hours result
        animateValue('hours-result', 0, totalMinutes, 1000, totalHours, remainingMinutes);

        const breakdownHtml = eventBreakdown.map(event => 
            `<tr>
                <td>${event.date}</td>
                <td>${event.title}</td>
                <td><strong>${Math.floor(event.duration / 60)}h ${Math.round(event.duration % 60)}m</strong></td>
            </tr>`
        ).join('');

        document.getElementById('events-breakdown').innerHTML = breakdownHtml;

        createDailyChart(dailyHours, daysInMonth);

        // Smooth scroll to results
        setTimeout(() => {
            document.getElementById('results-section').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 200);

    } catch (err) {
        console.error('Error calculating hours:', err);
        showError('Error calculating hours. Please try again.');
    } finally {
        // Reset button
        calculateBtn.disabled = false;
        calculateBtn.innerHTML = originalContent;
    }
}

function animateValue(id, start, end, duration, finalHours, finalMinutes) {
    const element = document.getElementById(id);
    const range = end - start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    let current = start;
    
    const timer = setInterval(() => {
        current += increment * 10;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
            element.innerHTML = `${finalHours}h ${finalMinutes}m`;
        } else {
            const tempHours = Math.floor(current / 60);
            const tempMinutes = Math.round(current % 60);
            element.innerHTML = `${tempHours}h ${tempMinutes}m`;
        }
    }, stepTime);
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

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.8)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.8)');

    hoursChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Hours',
                data: data,
                backgroundColor: gradient,
                borderRadius: 8,
                barThickness: 'flex'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    padding: 16,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    cornerRadius: 12,
                    titleFont: {
                        size: 14,
                        weight: '700'
                    },
                    bodyFont: {
                        size: 13,
                        weight: '500'
                    },
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
                        color: 'rgba(229, 231, 235, 0.5)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11,
                            weight: '600'
                        },
                        padding: 10
                    },
                    title: {
                        display: true,
                        text: 'Hours',
                        color: '#6b7280',
                        font: {
                            size: 13,
                            weight: '700'
                        },
                        padding: 10
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11,
                            weight: '600'
                        },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 15,
                        padding: 10
                    },
                    title: {
                        display: true,
                        text: 'Day of Month',
                        color: '#6b7280',
                        font: {
                            size: 13,
                            weight: '700'
                        },
                        padding: 10
                    }
                }
            }
        }
    });
}

async function generatePDF() {
    if (!currentReportData) {
        showError('Please calculate hours first before generating a report');
        return;
    }

    // Show loading state
    const pdfBtn = document.getElementById('pdf-button');
    const originalContent = pdfBtn.innerHTML;
    pdfBtn.disabled = true;
    pdfBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Generating...';

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 20;
        let yPosition = margin;

        // Header with gradient effect
        pdf.setFillColor(99, 102, 241);
        pdf.rect(0, 0, pageWidth, 50, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(32);
        pdf.setFont(undefined, 'bold');
        pdf.text('WorkyFinder', margin, 25);
        
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'normal');
        pdf.text('Working Hours Analytics Report', margin, 37);

        yPosition = 65;

        // Report Info Section
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.text('Calendar:', margin, yPosition);
        pdf.setFont(undefined, 'normal');
        pdf.text(currentReportData.calendarName, margin + 27, yPosition);
        
        yPosition += 8;
        pdf.setFont(undefined, 'bold');
        pdf.text('Period:', margin, yPosition);
        pdf.setFont(undefined, 'normal');
        pdf.text(currentReportData.monthName, margin + 27, yPosition);
        
        yPosition += 8;
        pdf.setFont(undefined, 'bold');
        pdf.text('Generated:', margin, yPosition);
        pdf.setFont(undefined, 'normal');
        pdf.text(new Date().toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
        }), margin + 27, yPosition);

        yPosition += 20;

        // Total Hours Box with gradient
        pdf.setFillColor(99, 102, 241);
        pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 32, 5, 5, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(15);
        pdf.setFont(undefined, 'bold');
        pdf.text('TOTAL WORKING HOURS', pageWidth / 2, yPosition + 12, { align: 'center' });
        
        pdf.setFontSize(24);
        const totalHoursText = `${currentReportData.totalHours}h ${currentReportData.totalMinutes}m`;
        pdf.text(totalHoursText, pageWidth / 2, yPosition + 25, { align: 'center' });

        yPosition += 42;

        // Capture chart as image
        try {
            const chartCanvas = document.getElementById('hoursChart');
            const chartImage = chartCanvas.toDataURL('image/png', 1.0);
            
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(15);
            pdf.setFont(undefined, 'bold');
            pdf.text('Daily Distribution', margin, yPosition);
            yPosition += 8;
            
            const chartWidth = pageWidth - 2 * margin;
            const chartHeight = 70;
            
            // Add border around chart
            pdf.setDrawColor(229, 231, 235);
            pdf.setLineWidth(0.5);
            pdf.roundedRect(margin, yPosition, chartWidth, chartHeight, 3, 3, 'S');
            
            pdf.addImage(chartImage, 'PNG', margin + 2, yPosition + 2, chartWidth - 4, chartHeight - 4);
            yPosition += chartHeight + 15;

        } catch (err) {
            console.error('Error capturing chart:', err);
        }

        // Events Table
        if (yPosition + 50 > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin;
        }

        pdf.setFontSize(15);
        pdf.setFont(undefined, 'bold');
        pdf.text('Events Breakdown', margin, yPosition);
        yPosition += 12;

        // Table Header
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 2, 2, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(107, 114, 128);
        pdf.text('DATE', margin + 4, yPosition + 7);
        pdf.text('EVENT', margin + 45, yPosition + 7);
        pdf.text('DURATION', pageWidth - margin - 30, yPosition + 7);
        
        yPosition += 14;

        // Table Rows
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(17, 24, 39);
        pdf.setFontSize(9);
        
        currentReportData.eventBreakdown.forEach((event, index) => {
            if (yPosition > pageHeight - margin - 12) {
                pdf.addPage();
                yPosition = margin;
                
                // Repeat header on new page
                pdf.setFillColor(248, 250, 252);
                pdf.roundedRect(margin, yPosition, pageWidth - 2 * margin, 10, 2, 2, 'F');
                pdf.setFontSize(9);
                pdf.setFont(undefined, 'bold');
                pdf.setTextColor(107, 114, 128);
                pdf.text('DATE', margin + 4, yPosition + 7);
                pdf.text('EVENT', margin + 45, yPosition + 7);
                pdf.text('DURATION', pageWidth - margin - 30, yPosition + 7);
                yPosition += 14;
                pdf.setFont(undefined, 'normal');
                pdf.setTextColor(17, 24, 39);
            }

            // Alternate row background
            if (index % 2 === 0) {
                pdf.setFillColor(249, 250, 251);
                pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 9, 'F');
            }

            const duration = `${Math.floor(event.duration / 60)}h ${Math.round(event.duration % 60)}m`;
            
            pdf.text(event.date, margin + 4, yPosition);
            
            // Truncate long event names
            let eventName = event.title;
            if (eventName.length > 48) {
                eventName = eventName.substring(0, 45) + '...';
            }
            pdf.text(eventName, margin + 45, yPosition);
            pdf.text(duration, pageWidth - margin - 30, yPosition);
            
            yPosition += 9;
        });

        // Footer on every page
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            const footerY = pageHeight - 15;
            pdf.setFontSize(8);
            pdf.setTextColor(107, 114, 128);
            pdf.text('Generated by WorkyFinder - Smart Working Hours Analytics', pageWidth / 2, footerY, { align: 'center' });
            pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, footerY + 5, { align: 'center' });
        }

        // Save PDF
        const fileName = `WorkyFinder_${currentReportData.monthName.replace(' ', '_')}.pdf`;
        pdf.save(fileName);

    } catch (err) {
        console.error('Error generating PDF:', err);
        showError('Error generating PDF. Please try again.');
    } finally {
        // Reset button
        pdfBtn.disabled = false;
        pdfBtn.innerHTML = originalContent;
    }
}

function showError(message) {
    alert(message);
}