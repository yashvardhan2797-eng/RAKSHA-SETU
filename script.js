// script.js
let timerId = null;
const overlay = document.getElementById('alertOverlay');
const cancelBtn = document.getElementById('cancel-btn');
const timerDisplay = document.getElementById('timerDisplay');

// Simulate emergency (for demo)
function startEmergency() {
    overlay.classList.remove('hidden');
    let timeLeft = 30; // 30 seconds countdown
    
    timerDisplay.innerText = timeLeft;
    
    if (timerId) clearInterval(timerId);
    
    timerId = setInterval(() => {
        timeLeft--;
        timerDisplay.innerText = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timerId);
            alert('Emergency services notified!');
        }
    }, 1000);
}

// Cancel alarm sequence
function cancelAlarm() {
    overlay.classList.add('hidden');
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
    alert('Alert cancelled. Emergency services stand down.');
}

// Dial functions
function dial(number) {
    window.open(`tel:${number}`, '_blank');
}

function callHospital(number) {
    window.open(`tel:${number}`, '_blank');
}

// Demo button (remove for production)
document.addEventListener('DOMContentLoaded', () => {
    // Auto demo after 3 seconds (remove this)
    setTimeout(() => {
        if (confirm('Demo emergency alert?')) {
            startEmergency();
        }
    }, 3000);
});

// Service worker for PWA (optional)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}
