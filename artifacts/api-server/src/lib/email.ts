import nodemailer from "nodemailer";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

// ── Local settings helper ─────────────────────────────────────────────────────
async function getSettingLocal(key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

// ── Config reader ─────────────────────────────────────────────────────────────
export interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  senderEmail: string;
  authCodeSet: boolean;
  daysBefore: number[];
  sendHour: number;
  lastRunAt: string | null;
  lastRunResult: { sent: number; errors: number } | null;
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const [
    enabled,
    smtpHost,
    smtpPort,
    smtpSecure,
    senderEmail,
    authCode,
    daysBefore,
    sendHour,
    lastRunAt,
    lastRunResult,
  ] = await Promise.all([
    getSettingLocal("email_enabled"),
    getSettingLocal("email_smtp_host"),
    getSettingLocal("email_smtp_port"),
    getSettingLocal("email_smtp_secure"),
    getSettingLocal("email_sender"),
    getSettingLocal("email_auth_code"),
    getSettingLocal("email_days_before"),
    getSettingLocal("email_send_hour"),
    getSettingLocal("email_last_run"),
    getSettingLocal("email_last_result"),
  ]);

  // DB value takes precedence; fall back to legacy env vars
  const effectiveSender = senderEmail || process.env.QQ_EMAIL || "";
  const effectiveAuthCode = authCode || process.env.QQ_EMAIL_AUTH || "";

  return {
    enabled: enabled !== "false",
    smtpHost: smtpHost || "smtp.qq.com",
    smtpPort: smtpPort ? parseInt(smtpPort, 10) : 465,
    smtpSecure: smtpSecure !== "false",
    senderEmail: effectiveSender,
    authCodeSet: !!effectiveAuthCode,
    daysBefore: daysBefore
      ? daysBefore
          .split(",")
          .map(Number)
          .filter((n) => !isNaN(n))
      : [0, 1],
    sendHour: sendHour ? parseInt(sendHour, 10) : 8,
    lastRunAt,
    lastRunResult: lastRunResult ? JSON.parse(lastRunResult) : null,
  };
}

// ── Transporter factory ────────────────────────────────────────────────────────
async function buildTransporter(): Promise<nodemailer.Transporter | null> {
  const smtpHost = (await getSettingLocal("email_smtp_host")) || "smtp.qq.com";
  const smtpPort = parseInt(
    (await getSettingLocal("email_smtp_port")) || "465",
    10,
  );
  const smtpSecure = (await getSettingLocal("email_smtp_secure")) !== "false";
  const sender =
    (await getSettingLocal("email_sender")) || process.env.QQ_EMAIL;
  const authCode =
    (await getSettingLocal("email_auth_code")) || process.env.QQ_EMAIL_AUTH;

  if (!sender || !authCode) return null;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: sender, pass: authCode },
  });
}

// ── Birthday reminder ─────────────────────────────────────────────────────────
export interface BirthdayReminderData {
  toEmail: string;
  contactName: string;
  birthdayDisplay: string;
  daysUntil: number;
  age: number | null;
  relation: string | null;
}

export async function sendBirthdayReminder(
  data: BirthdayReminderData,
): Promise<void> {
  const transporter = await buildTransporter();
  if (!transporter) throw new Error("邮件服务未配置");

  const senderEmail =
    (await getSettingLocal("email_sender")) || process.env.QQ_EMAIL!;

  const daysText =
    data.daysUntil === 0
      ? "今天就是"
      : data.daysUntil === 1
        ? "明天就是"
        : `还有 ${data.daysUntil} 天就是`;
  const ageText = data.age !== null ? `（${data.age + 1}岁生日）` : "";
  const relText = data.relation ? `（${data.relation}）` : "";

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>生日提醒</title></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#ff6b8a,#ff4757);padding:40px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🎂</div>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;letter-spacing:1px;">生日提醒</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">来自生日通的温馨提醒</p>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;color:#333;margin:0 0 20px;line-height:1.7;">
        ${daysText} <strong style="color:#ff4757;">${data.contactName}</strong>${relText} 的生日${ageText}！
      </p>
      <div style="background:#fff5f7;border:1px solid #ffd6de;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:36px;">🎉</div>
          <div>
            <div style="font-size:20px;font-weight:700;color:#ff4757;">${data.contactName}</div>
            <div style="font-size:14px;color:#888;margin-top:4px;">生日：${data.birthdayDisplay}${ageText}</div>
          </div>
        </div>
      </div>
      ${
        data.daysUntil <= 1
          ? `
      <div style="background:#fffbf0;border:1px solid #ffe58f;border-radius:10px;padding:16px;margin-bottom:24px;font-size:14px;color:#856404;">
        <strong>⏰ 温馨提示：</strong>别忘了提前准备一份心意礼物，让 ${data.contactName} 感受到您的祝福！
      </div>`
          : ""
      }
      <p style="font-size:14px;color:#999;line-height:1.8;margin:0;">此提醒由 <strong>生日通</strong> 自动发送。</p>
    </div>
    <div style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#bbb;">© 生日通 · 记住每一个重要的日子</p>
    </div>
  </div>
</body>
</html>`.trim();

  const subject =
    data.daysUntil === 0
      ? `🎂 今天是 ${data.contactName} 的生日！`
      : data.daysUntil === 1
        ? `🎂 明天是 ${data.contactName} 的生日！`
        : `🎂 ${data.daysUntil} 天后是 ${data.contactName} 的生日`;

  await transporter.sendMail({
    from: `"生日通" <${senderEmail}>`,
    to: data.toEmail,
    subject,
    html,
  });

  logger.info(
    { to: data.toEmail, contact: data.contactName, daysUntil: data.daysUntil },
    "Birthday reminder email sent",
  );
}

// ── Event reminder ────────────────────────────────────────────────────────────
export interface EventReminderData {
  toEmail:    string;
  eventName:  string;
  eventType:  "anniversary" | "countdown" | "other";
  dateDisplay: string;
  daysUntil:  number;
  person?:    string | null;
}

export async function sendEventReminder(data: EventReminderData): Promise<void> {
  const transporter = await buildTransporter();
  if (!transporter) throw new Error("邮件服务未配置");
  const senderEmail = (await getSettingLocal("email_sender")) || process.env.QQ_EMAIL!;

  const typeMap = {
    anniversary: { label: "纪念日", icon: "🥂" },
    countdown:   { label: "倒数日", icon: "⏳" },
    other:       { label: "提醒",   icon: "🔔" },
  };
  const { label, icon } = typeMap[data.eventType];
  const personText = data.person ? `（${data.person}）` : "";
  const daysText =
    data.daysUntil === 0 ? "今天就是" :
    data.daysUntil === 1 ? "明天就是" :
    `还有 ${data.daysUntil} 天就是`;

  const subject =
    data.daysUntil === 0 ? `${icon} 今天：${data.eventName}${personText} ${label}` :
    data.daysUntil === 1 ? `${icon} 明天：${data.eventName}${personText} ${label}` :
    `${icon} ${data.daysUntil} 天后：${data.eventName}${personText} ${label}`;

  const html = `<!DOCTYPE html><html lang="zh-CN">
<head><meta charset="UTF-8"><title>${label}提醒</title></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#ff6b8a,#ff4757);padding:40px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">${icon}</div>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;">${label}提醒</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">来自生日通的温馨提醒</p>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;color:#333;margin:0 0 20px;line-height:1.7;">
        ${daysText} <strong style="color:#ff4757;">${data.eventName}${personText}</strong> 的${label}！
      </p>
      <div style="background:#fff5f7;border:1px solid #ffd6de;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-size:20px;font-weight:700;color:#ff4757;">${data.eventName}${personText}</div>
        <div style="font-size:14px;color:#888;margin-top:4px;">日期：${data.dateDisplay}</div>
      </div>
      <p style="font-size:14px;color:#999;line-height:1.8;margin:0;">此提醒由 <strong>生日通</strong> 自动发送。</p>
    </div>
    <div style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#bbb;">© 生日通 · 记住每一个重要的日子</p>
    </div>
  </div>
</body></html>`;

  await transporter.sendMail({ from: `"生日通" <${senderEmail}>`, to: data.toEmail, subject, html });
  logger.info({ to: data.toEmail, event: data.eventName, type: data.eventType, daysUntil: data.daysUntil }, "Event reminder email sent");
}

// ── Capsule reminder ──────────────────────────────────────────────────────────
export interface CapsuleReminderData {
  toEmail:  string;
  title:    string;
  openAt:   string;
  daysUntil: number;
}

export async function sendCapsuleReminder(data: CapsuleReminderData): Promise<void> {
  const transporter = await buildTransporter();
  if (!transporter) throw new Error("邮件服务未配置");
  const senderEmail = (await getSettingLocal("email_sender")) || process.env.QQ_EMAIL!;

  const daysText =
    data.daysUntil === 0 ? "今天" :
    data.daysUntil === 1 ? "明天" :
    `${data.daysUntil} 天后`;

  const subject =
    data.daysUntil === 0 ? `🔒 时间胶囊今天开启：${data.title}` :
    `🔒 时间胶囊${daysText}开启：${data.title}`;

  const html = `<!DOCTYPE html><html lang="zh-CN">
<head><meta charset="UTF-8"><title>时间胶囊提醒</title></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#a18cd1,#fbc2eb);padding:40px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🔒</div>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;">时间胶囊提醒</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">来自生日通的温馨提醒</p>
    </div>
    <div style="padding:32px;">
      <p style="font-size:16px;color:#333;margin:0 0 20px;line-height:1.7;">
        您的时间胶囊将于 <strong style="color:#a18cd1;">${daysText}</strong> 开启！
      </p>
      <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="font-size:20px;font-weight:700;color:#a18cd1;">🔒 ${data.title}</div>
        <div style="font-size:14px;color:#888;margin-top:4px;">开启时间：${data.openAt}</div>
      </div>
      <p style="font-size:14px;color:#999;line-height:1.8;margin:0;">此提醒由 <strong>生日通</strong> 自动发送。</p>
    </div>
    <div style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#bbb;">© 生日通 · 记住每一个重要的日子</p>
    </div>
  </div>
</body></html>`;

  await transporter.sendMail({ from: `"生日通" <${senderEmail}>`, to: data.toEmail, subject, html });
  logger.info({ to: data.toEmail, title: data.title, daysUntil: data.daysUntil }, "Capsule reminder email sent");
}

// ── SMTP verification ─────────────────────────────────────────────────────────
export async function verifyEmailConfig(): Promise<{
  ok: boolean;
  message: string;
}> {
  const transporter = await buildTransporter();
  if (!transporter) {
    return { ok: false, message: "发件邮箱或授权码未配置" };
  }
  try {
    await transporter.verify();
    logger.info("Email SMTP configuration verified");
    return { ok: true, message: "SMTP 连接验证成功" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Email SMTP verification failed");
    return { ok: false, message: `验证失败：${msg.slice(0, 80)}` };
  }
}

// ── Test email ────────────────────────────────────────────────────────────────
export async function sendTestEmail(
  toEmail: string,
): Promise<{ ok: boolean; message: string }> {
  const transporter = await buildTransporter();
  if (!transporter) {
    return { ok: false, message: "发件邮箱或授权码未配置" };
  }
  const sender =
    (await getSettingLocal("email_sender")) || process.env.QQ_EMAIL!;
  try {
    await transporter.sendMail({
      from: `"生日通" <${sender}>`,
      to: toEmail,
      subject: "🎂 生日通邮件配置测试",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:12px;">
        <h2 style="color:#ff4757;">✅ 邮件配置测试成功</h2>
        <p>您好！这是来自 <strong>生日通</strong> 管理后台的测试邮件。</p>
        <p>如果你收到此邮件，说明 SMTP 配置已正确生效，生日提醒邮件将能够正常发送。</p>
        <p style="color:#999;font-size:12px;margin-top:24px;">© 生日通 · 记住每一个重要的日子</p>
      </div>`,
    });
    return { ok: true, message: `测试邮件已发送至 ${toEmail}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `发送失败：${msg.slice(0, 100)}` };
  }
}
