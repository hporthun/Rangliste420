export async function register() {
  // Only run in Node.js runtime (not Edge), and only on the server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initBackupScheduler } = await import("./lib/backup/scheduler");
    await initBackupScheduler();
  }
}
