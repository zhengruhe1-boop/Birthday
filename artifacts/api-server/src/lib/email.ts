import nodemailer from "nodemailer";
import { logger } from "./logger.js";

const QQ_EMAIL = process.env.QQ_EMAIL;
const QQ_EMAIL_AUTH = process.env.QQ_EMAIL_AUTH;

function createTransporter() {
  if (!QQ_EMAIL || !QQ_EMAIL_AUTH) {
    throw new Error("QQ_EMAIL and QQ_EMAIL_AUTH environment variables are required");
  }
  return nodemailer.createTransport({
    host: "smtp.qq.com",
    port: 465,
    secure: true,
    auth: {
      user: QQ_EMAIL,
      pass: QQ_EMAIL_AUTH,
    },
  });
}

export interface BirthdayReminderData {
  toEmail: string;
  contactName: string;
  birthdayDisplay: string;
  daysUntil: number;
  age: number | null;
  relation: string | null;
}

export async function sendBirthdayReminder(data: BirthdayReminderData): Promise<void> {
  const transporter = createTransporter();

  const daysText = data.daysUntil === 0
    ? "今天就是"
    : data.daysUntil === 1
      ? "明天就是"
      : `还有 ${data.daysUntil} 天就是`;

  const ageText = data.age !== null ? `（${data.age + 1}岁生日）` : "";
  const relationText = data.relation ? `（${data.relation}）` : "";

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>生日提醒</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#ff6b8a,#ff4757);padding:40px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🎂</div>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;letter-spacing:1px;">生日提醒</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">来自生日通的温馨提醒</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="font-size:16px;color:#333;margin:0 0 20px;line-height:1.7;">
        ${daysText} <strong style="color:#ff4757;">${data.contactName}</strong>${relationText} 的生日${ageText}！
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

      ${data.daysUntil <= 1 ? `
      <div style="background:#fffbf0;border:1px solid #ffe58f;border-radius:10px;padding:16px;margin-bottom:24px;font-size:14px;color:#856404;">
        <strong>⏰ 温馨提示：</strong>别忘了提前准备一份心意礼物，让 ${data.contactName} 感受到你的祝福！
      </div>
      ` : ""}

      <p style="font-size:14px;color:#999;line-height:1.8;margin:0;">
        此提醒由 <strong>生日通</strong> 自动发送。你可以在应用中管理亲友的生日提醒邮箱设置。
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#bbb;">
        © 生日通 · 记住每一个重要的日子
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const subject = data.daysUntil === 0
    ? `🎂 今天是 ${data.contactName} 的生日！`
    : data.daysUntil === 1
      ? `🎂 明天是 ${data.contactName} 的生日！`
      : `🎂 ${data.daysUntil} 天后是 ${data.contactName} 的生日`;

  await transporter.sendMail({
    from: `"生日通" <${QQ_EMAIL}>`,
    to: data.toEmail,
    subject,
    html,
  });

  logger.info({ to: data.toEmail, contact: data.contactName, daysUntil: data.daysUntil }, "Birthday reminder sent");
}

export async function verifyEmailConfig(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info("Email configuration verified successfully");
    return true;
  } catch (err) {
    logger.error({ err }, "Email configuration verification failed");
    return false;
  }
}
