// API Configuration
const API_BASE = 'http://localhost:5000/api';

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const previewArea = document.getElementById('previewArea');
const analyzeBtn = document.getElementById('analyzeBtn');
const viewResultsBtn = document.getElementById('viewResultsBtn');
const downloadBtn = document.getElementById('downloadBtn');
const loadingSpinner = document.getElementById('loadingSpinner');

// Global variables
let currentFile = null;
let analysisResult = null;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadDashboardData();
    loadRecentAnalytics();
    loadAlerts();
});

function initializeEventListeners() {
    // File upload handling
    fileInput.addEventListener('change', handleFileSelect);
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
    
    // Button events
    analyzeBtn.addEventListener('click', analyzeFile);
    viewResultsBtn.addEventListener('click', viewResults);
    downloadBtn.addEventListener('click', downloadReport);
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
    
    // Get started button
    document.getElementById('getStartedBtn').addEventListener('click', () => {
        document.getElementById('upload').scrollIntoView({ behavior: 'smooth' });
    });
}

// File handling functions
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processFile(file);
}

function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('active');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('active');
}

function handleFileDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('active');
    const file = event.dataTransfer.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    // Validate file
    if (!validateFile(file)) return;
    
    currentFile = file;
    
    // Show file details
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    document.getElementById('uploadStatus').textContent = 'Ready for analysis';
    
    // Show preview
    showFilePreview(file);
    
    // Show upload details section
    document.getElementById('uploadDetails').style.display = 'block';
    
    // Enable analyze button
    analyzeBtn.disabled = false;
}

function validateFile(file) {
    const maxSize = 500 * 1024 * 1024; // 500MB
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'image/jpeg', 'image/png'];
    
    if (file.size > maxSize) {
        alert('File size must be less than 500MB');
        return false;
    }
    
    if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid video or image file (MP4, MOV, AVI, MKV, JPG, PNG)');
        return false;
    }
    
    return true;
}

function showFilePreview(file) {
    const previewIcon = document.getElementById('previewIcon');
    const previewText = document.getElementById('previewText');
    
    if (file.type.startsWith('video/')) {
        const videoURL = URL.createObjectURL(file);
        previewArea.innerHTML = `
            <video controls style="width: 100%; height: 100%;">
                <source src="${videoURL}" type="${file.type}">
                Your browser does not support the video tag.
            </video>
        `;
    } else if (file.type.startsWith('image/')) {
        const imageURL = URL.createObjectURL(file);
        previewArea.innerHTML = `<img src="${imageURL}" alt="Preview" style="width: 100%; height: 100%; object-fit: contain;">`;
    }
}

// Analysis functions
async function analyzeFile() {
    if (!currentFile) return;
    
    const formData = new FormData();
    formData.append('file', currentFile);
    
    showLoading(true);
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    
    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            analysisResult = result;
            updateAnalysisUI(result);
            showSuccess('Analysis completed successfully!');
        } else {
            throw new Error(result.error || 'Analysis failed');
        }
    } catch (error) {
        console.error('Analysis error:', error);
        showError('Analysis failed: ' + error.message);
    } finally {
        showLoading(false);
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-brain"></i> Analyze with YOLOv8 AI';
    }
}

function updateAnalysisUI(result) {
    // Update detection stats
    document.getElementById('peopleCount').textContent = result.average_people;
    document.getElementById('densityLevel').textContent = result.density_level;
    document.getElementById('confidence').textContent = '95%';
    
    // Update analytics cards
    document.getElementById('densityInfo').textContent =
        `${result.density_level} Density - ${result.average_people} people detected`;
    document.getElementById('statsInfo').textContent =
        `Average: ${result.average_people} people | Frames: ${result.total_frames} | Duration: ${(result.video_properties?.duration_seconds || 0)}s`;
    document.getElementById('alertInfo').textContent =
        result.density_level === 'High'
            ? `🚨 High Density Alert: ${result.average_people} people detected`
            : '✅ No alerts - Normal density';
    
    // Enable result buttons
    viewResultsBtn.disabled = false;
    downloadBtn.disabled = false;
    
    // Update dashboard with new data
    loadDashboardData();
    loadRecentAnalytics();
    loadAlerts();
}

function viewResults() {
    if (!analysisResult?.processed_path) return;
    const analysisPlayer = document.getElementById('analysisPlayer');
    analysisPlayer.innerHTML = `
        <video controls autoplay style="width: 100%; height: 100%;">
            <source src="${analysisResult.processed_path}" type="video/mp4" />
            Your browser does not support the video tag.
        </video>
        <div class="detection-stats">
            <div>People Detected: <span id="peopleCount">${analysisResult.average_people}</span></div>
            <div>Density Level: <span id="densityLevel">${analysisResult.density_level}</span></div>
            <div>Confidence: <span id="confidence">95%</span></div>
        </div>
    `;
}

function downloadReport() {
    if (!analysisResult) return;
    // Create a simple report
    const report = {
        title: 'Crowd Analysis Report',
        timestamp: new Date().toISOString(),
        ...analysisResult
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crowd-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Data loading functions
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE}/analytics`);
        const data = await response.json();
        updateTempleDashboard(data.temples);
        updateDashboardMetrics(data);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateTempleDashboard(temples) {
    const dashboardGrid = document.getElementById('templeDashboard');
    const templesGrid = document.getElementById('templesGrid');
    
    if (!temples) return;
    
    // Update main dashboard
    dashboardGrid.innerHTML = temples.map(temple => `
        <div class="metric-card fade-in">
            <i class="fas fa-place-of-worship"></i>
            <h3>${temple.current_count}</h3>
            <p>${temple.name}</p>
            <div class="crowd-status">
                <div class="status-indicator status-${temple.status.toLowerCase()}"></div>
                <span>${temple.status} Crowd</span>
            </div>
            <div class="capacity-bar">
                <div class="capacity-fill" style="width: ${(temple.current_count / temple.capacity) * 100}%"></div>
            </div>
            <small>Capacity: ${temple.capacity} people</small>
        </div>
    `).join('');
    
    // Update temples grid
    templesGrid.innerHTML = temples.map(temple => `
        <div class="temple-card fade-in">
            <div class="temple-img" style="background-image: url('https://source.unsplash.com/random/800x600/?temple,${temple.name.split(' ')[0]}')"></div>
            <div class="temple-info">
                <h3>${temple.name}</h3>
                <p>${temple.location}</p>
                <div class="crowd-status">
                    <div class="status-indicator status-${temple.status.toLowerCase()}"></div>
                    <span>${temple.status} Crowd - ${temple.current_count} people</span>
                </div>
                <div class="capacity-bar">
                    <div class="capacity-fill" style="width: ${Math.min((temple.current_count / temple.capacity) * 100, 100)}%"></div>
                </div>
                <p><small>Capacity: ${temple.capacity} people | Last updated: ${formatDate(temple.last_updated)}</small></p>
                <button class="btn btn-outline" onclick="updateTempleCount(${temple.id})">
                    <i class="fas fa-sync-alt"></i> Update Count
                </button>
            </div>
        </div>
    `).join('');
}

async function updateTempleCount(templeId) {
    const count = prompt('Enter current crowd count:');
    if (count && !isNaN(count)) {
        try {
            await fetch(`${API_BASE}/temple/${templeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: parseInt(count) })
            });
            loadDashboardData();
            showSuccess('Temple count updated successfully!');
        } catch (error) {
            showError('Failed to update temple count');
        }
    }
}

function updateDashboardMetrics(data) {
    // Update overall metrics based on analytics
    if (data.analytics && data.analytics.length > 0) {
        const latest = data.analytics[0];
        document.getElementById('peopleCount').textContent = latest.people_count;
        document.getElementById('densityLevel').textContent = latest.density_level;
    }
}

async function loadRecentAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/analytics`);
        const data = await response.json();
        const analyticsBody = document.getElementById('analyticsBody');
        if (data.analytics) {
            analyticsBody.innerHTML = data.analytics.map(item => `
                <tr class="fade-in">
                    <td>${item.filename}</td>
                    <td>${item.people_count}</td>
                    <td><span class="density-badge density-${item.density_level.toLowerCase()}">${item.density_level}</span></td>
                    <td>${formatDate(item.created_at)}</td>
                    <td>
                        <button class="btn btn-outline" onclick="viewAnalysis('${item.processed_path}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

async function loadAlerts() {
    try {
        const response = await fetch(`${API_BASE}/analytics`);
        const data = await response.json();
        const alertsContainer = document.getElementById('alertsContainer');
        if (data.alerts) {
            alertsContainer.innerHTML = data.alerts.map(alert => `
                <div class="alert-card alert-${alert.severity || 'medium'} fade-in">
                    <div class="alert-header">
                        <div class="alert-title">
                            <i class="fas fa-exclamation-triangle"></i>
                            ${alert.alert_type}
                        </div>
                        <div class="alert-time">${formatDate(alert.created_at)}</div>
                    </div>
                    <p>${alert.message}</p>
                    <small>File: ${alert.filename}</small>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showLoading(show) {
    loadingSpinner.style.display = show ? 'flex' : 'none';
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
        <span>${message}</span>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white;
        padding: 1rem;
        border-radius: 5px;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
// Video control functions
async function loadProcessedVideo() {
    try {
        const response = await fetch('/api/get-processed-video');
        const data = await response.json();
        
        const videoElement = document.getElementById('processedVideo');
        const placeholder = document.getElementById('videoPlaceholder');
        
        if (data.exists) {
            // Show video and hide placeholder
            videoElement.style.display = 'block';
            placeholder.style.display = 'none';
            
            // Set video source with cache busting
            videoElement.src = data.video_url + '?t=' + new Date().getTime();
            videoElement.load();
            
            // Enable download button
            document.getElementById('downloadBtn').disabled = false;
            
            console.log('Video loaded:', data.video_url);
            showNotification('Processed video loaded successfully!', 'success');
        } else {
            // Show placeholder
            videoElement.style.display = 'none';
            placeholder.style.display = 'block';
            placeholder.innerHTML = `<p>${data.message || 'No processed video available'}</p>`;
            
            document.getElementById('downloadBtn').disabled = true;
        }
        
    } catch (error) {
        console.error('Error loading video:', error);
        showNotification('Error loading video: ' + error.message, 'error');
    }
}

function refreshVideo() {
    const videoElement = document.getElementById('processedVideo');
    if (videoElement.src) {
        videoElement.src += '?t=' + new Date().getTime();
        videoElement.load();
        showNotification('Video refreshed', 'info');
    }
}

async function downloadVideo() {
    try {
        const response = await fetch('/api/get-processed-video');
        const data = await response.json();
        
        if (data.exists) {
            // Create a temporary link for download
            const downloadLink = document.createElement('a');
            downloadLink.href = data.video_url;
            downloadLink.download = data.filename;
            downloadLink.click();
            
            showNotification('Download started!', 'success');
        } else {
            showNotification('No video available for download', 'error');
        }
        
    } catch (error) {
        console.error('Error downloading video:', error);
        showNotification('Error downloading video', 'error');
    }
}

// Check video progress periodically
async function checkVideoProgress() {
    try {
        const response = await fetch('/api/video-progress');
        const data = await response.json();
        
        if (data.processed) {
            // Video processing complete, enable view button
            document.getElementById('viewResultsBtn').disabled = false;
            document.getElementById('viewResultsBtn').textContent = 'View Results (' + data.count + ')';
        }
    } catch (error) {
        console.error('Error checking video progress:', error);
    }
}

// Utility function for notifications
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        border-radius: 5px;
        color: white;
        z-index: 1000;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

// Auto-check for processed videos every 10 seconds
setInterval(checkVideoProgress, 10000);

// Initial check when page loads
document.addEventListener('DOMContentLoaded', function() {
    checkVideoProgress();
    loadProcessedVideo(); // Try to load existing video
});

function handleNavigation(event) {
    event.preventDefault();
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Scroll to section
    const targetId = event.target.getAttribute('href').substring(1);
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Add CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(notificationStyles);

// Health check on startup
fetch(`${API_BASE}/health`)
    .then(response => response.json())
    .then(data => console.log('API Health:', data))
    .catch(error => console.error('API Connection failed:', error));