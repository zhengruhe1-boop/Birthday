import app from "./app";
import { logger } from "./lib/logger";
import { scheduleDailyReminders } from "./lib/reminder.js";
import { scheduleWechatNotifications } from "./lib/wechat-notify.js";
import { runStartupMigrations } from "./lib/migrate.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Run startup DB migrations (creates any missing tables safely)
  runStartupMigrations().then(() => {
    // Start the daily birthday reminder scheduler (runs every day at 08:00)
    scheduleDailyReminders();

    // Start the WeChat Official Account birthday notification scheduler
    scheduleWechatNotifications();
  });
});
