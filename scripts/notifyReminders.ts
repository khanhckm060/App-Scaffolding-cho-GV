/**
 * Standalone script to trigger the reminder check via internal API.
 * This is scheduled to run every hour.
 */
async function triggerReminders() {
  console.log("[CRON] Triggering reminder check...");
  try {
    const response = await fetch('http://localhost:3000/api/internal/check-reminders');
    const result = await response.json();
    console.log("[CRON] Result:", result);
  } catch (error) {
    console.error("[CRON] Error reaching server:", error);
  }
}

triggerReminders();
