/**
 * Hostel Complaint Management System - Custom JS Helper Functions
 * Includes dynamic priority preview animations and interactive UI feedback
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("[*] Hostel Complaint System Frontend Initialized");
    
    // 1. Dynamic Interactive Indicator for Complaint Box
    const complaintTextarea = document.getElementById('complaint_text');
    const liveIndicator = document.getElementById('live-ai-indicator');
    
    if (complaintTextarea && liveIndicator) {
        // High risk keywords to show live visual warning level
        const redKeywords = ['fire', 'electricity', 'shock', 'spark', 'short circuit', 'power cut', 'outsider', 'stray dog', 'theft', 'danger'];
        const orangeKeywords = ['leakage', 'wifi', 'internet', 'clogged', 'dirty toilet', 'not working'];

        complaintTextarea.addEventListener('input', (e) => {
            const text = e.target.value.toLowerCase();
            
            if (text.trim().length === 0) {
                liveIndicator.style.display = 'none';
                return;
            }
            
            liveIndicator.style.display = 'block';
            
            // Basic regex logic matching what the backend Python code runs
            let priority = "Green (Low)";
            let badgeClass = "badge-priority-Green";
            let descText = "This looks like a minor issue. It will be scheduled for regular maintenance.";
            
            if (redKeywords.some(kw => text.includes(kw))) {
                priority = "Red (High)";
                badgeClass = "badge-priority-Red";
                descText = "Critical security or utility failure detected! Warden notification will be prioritized.";
            } else if (orangeKeywords.some(kw => text.includes(kw))) {
                priority = "Orange (Medium)";
                badgeClass = "badge-priority-Orange";
                descText = "Standard maintenance issue detected. Scheduled for prompt correction.";
            }
            
            liveIndicator.innerHTML = `
                <div style="margin-top: 10px; padding: 10px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.85rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                        <strong style="color: #4f46e5; display: flex; align-items: center; gap: 4px;">
                            ⚡ Live AI Prediction Preview:
                        </strong>
                        <span class="badge ${badgeClass}">${priority}</span>
                    </div>
                    <p style="color: #64748b; font-size: 0.8rem; line-height: 1.3;">${descText}</p>
                </div>
            `;
        });
    }

    // 2. Alert fade out handler
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            setTimeout(() => alert.remove(), 500);
        }, 4000);
    });
});
