/**
 * immediate-notify.ts
 *
 * 当用户在每日推送时刻之后新增/修改记录时，立即补发当天应发而未发的通知。
 * 以 fire-and-forget 方式调用，不阻塞 API 响应。
 */

import { db, contactsTable, eventsTable, usersTable, timeCapsulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { calcDaysUntilBirthday } from "./birthday.js";
import { getAccessToken, getNotifyConfig } from "./wechat-notify.js";
import { getMpAccessToken, getMpNotifyConfig } from "./wechat-mp-notify.js";
import { logger } from "./logger.js";

// ── Date helpers ──────────────────────────────────────────────────────────────

function daysUntilDate(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + "T00:00:00").getTime() - today.getTime()) / 86400000);
}

function daysUntilAnniversary(dateStr: string): { days: number; targetDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  const thisYr = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (thisYr < today) thisYr.setFullYear(today.getFullYear() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    days: Math.round((thisYr.getTime() - today.getTime()) / 86400000),
    targetDate: `${thisYr.getFullYear()}-${pad(thisYr.getMonth() + 1)}-${pad(thisYr.getDate())}`,
  };
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function trunc(s: string, max = 20) { return s.length <= max ? s : s.slice(0, max - 1) + "…"; }

// ── OA 模板消息 ───────────────────────────────────────────────────────────────

async function sendOaTemplateMsg(
  token: string,
  templateId: string,
  openId: string,
  nameField: string,
  timeField: string,
  opts: { h5Url: string; mpLinkEnabled: boolean; mpLinkAppId: string; mpLinkPagePath: string },
): Promise<boolean> {
  const payload: Record<string, unknown> = {
    touser:      openId,
    template_id: templateId,
    data: { thing19: { value: nameField }, time24: { value: timeField } },
  };
  if (opts.mpLinkEnabled && opts.mpLinkAppId) {
    payload.miniprogram = {
      appid:    opts.mpLinkAppId,
      pagepath: opts.mpLinkPagePath.replace(/\.html$/i, ""),
    };
  } else if (opts.h5Url) {
    payload.url = opts.h5Url;
  }
  try {
    const res  = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const data = await res.json() as { errcode?: number; errmsg?: string };
    return data.errcode === 0 || data.errmsg === "ok";
  } catch { return false; }
}

// ── 小程序订阅消息 ────────────────────────────────────────────────────────────

async function sendMpSubscribeMsg(
  token: string,
  templateId: string,
  openId: string,
  name: string,
  dateStr: string,
  tip: string,
): Promise<{ ok: boolean; revoked?: boolean }> {
  const payload = {
    touser:            openId,
    template_id:       templateId,
    page:              "pages/home/home",
    miniprogram_state: "formal",
    lang:              "zh_CN",
    data: {
      name1:  { value: name.slice(0, 20) },
      thing6: { value: dateStr.slice(0, 20) },
      thing5: { value: tip.slice(0, 20) },
    },
  };
  try {
    const res    = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const result = await res.json() as { errcode: number; errmsg: string };
    return { ok: result.errcode === 0, revoked: result.errcode === 43101 };
  } catch { return { ok: false }; }
}

// ── 核心：为指定记录补发当天应发未发的通知 ──────────────────────────────────

export async function triggerImmediateNotifyIfNeeded(
  userId: number,
  itemType: "contact" | "event" | "capsule",
  itemId: number,
): Promise<void> {
  try {
    const now         = new Date();
    const currentHour = now.getHours();

    const [oaCfg, mpCfg] = await Promise.all([getNotifyConfig(), getMpNotifyConfig()]);

    // 只有在当天推送时刻之后才需要补发（时刻之前由定时任务统一处理）
    const shouldOa = oaCfg.enabled && currentHour >= oaCfg.sendHour;
    const shouldMp = mpCfg.enabled && currentHour >= mpCfg.sendHour;
    if (!shouldOa && !shouldMp) return;

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users.length) return;
    const user = users[0];

    // ── 计算该条记录的提醒参数 ─────────────────────────────────────────────
    interface ItemInfo {
      oaName:    string;
      oaTime:    string;
      mpName:    string;
      mpDate:    string;
      daysUntil: number;
      effDays:   number[];
    }

    async function buildItemInfo(): Promise<ItemInfo | null> {
      if (itemType === "contact") {
        const rows = await db.select().from(contactsTable)
          .where(eq(contactsTable.id, itemId)).limit(1);
        if (!rows.length) return null;
        const c = rows[0];
        const days = calcDaysUntilBirthday(
          c.birthdayMonth, c.birthdayDay, c.birthYear ?? undefined, c.birthdayLunar,
        );
        const effDays = c.reminderDaysBefore
          ? c.reminderDaysBefore.split(",").map(Number).filter(n => !isNaN(n))
          : oaCfg.daysBefore;
        const dateStr = `${now.getFullYear()}-${pad(c.birthdayMonth)}-${pad(c.birthdayDay)}`;
        return {
          oaName:    trunc(`${c.name} · 生日`),
          oaTime:    dateStr,
          mpName:    c.name,
          mpDate:    `${pad(c.birthdayMonth)}月${pad(c.birthdayDay)}日`,
          daysUntil: days,
          effDays,
        };
      } else if (itemType === "event") {
        const rows = await db.select().from(eventsTable)
          .where(eq(eventsTable.id, itemId)).limit(1);
        if (!rows.length) return null;
        const e = rows[0];
        const evtEffDays = e.reminderDaysBefore
          ? e.reminderDaysBefore.split(",").map(Number).filter(n => !isNaN(n))
          : oaCfg.daysBefore;

        if (e.type === "anniversary" && e.eventDate) {
          const { days, targetDate } = daysUntilAnniversary(e.eventDate);
          const d = new Date(targetDate + "T00:00:00");
          return {
            oaName:    trunc(`${e.name}${e.person ? `(${e.person})` : ""} · 纪念日`),
            oaTime:    targetDate,
            mpName:    e.name,
            mpDate:    `${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`,
            daysUntil: days,
            effDays:   evtEffDays,
          };
        } else if (e.type === "countdown" && e.eventDate) {
          const days = daysUntilDate(e.eventDate);
          const d    = new Date(e.eventDate + "T00:00:00");
          return {
            oaName:    trunc(`${e.name} · 倒数日`),
            oaTime:    e.eventDate.slice(0, 10),
            mpName:    e.name,
            mpDate:    `${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`,
            daysUntil: days,
            effDays:   evtEffDays,
          };
        } else if (e.type === "other" && e.reminderTime) {
          const dateOnly = e.reminderTime.slice(0, 10);
          const days     = daysUntilDate(dateOnly);
          const d        = new Date(dateOnly + "T00:00:00");
          const hh       = e.reminderTime.slice(11, 13) || "00";
          const mm       = e.reminderTime.slice(14, 16) || "00";
          return {
            oaName:    trunc(`${e.name} · 其它`),
            oaTime:    `${dateOnly} ${hh}:${mm}`,
            mpName:    e.name,
            mpDate:    `${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`,
            daysUntil: days,
            effDays:   evtEffDays,
          };
        }
        return null;
      } else {
        // capsule
        const rows = await db.select().from(timeCapsulesTable)
          .where(eq(timeCapsulesTable.id, itemId)).limit(1);
        if (!rows.length) return null;
        const cap = rows[0];
        if (!cap.notifyEnabled) return null;
        const dateOnly = cap.openAt.slice(0, 10);   // "YYYY-MM-DD"
        const days     = daysUntilDate(dateOnly);
        const d        = new Date(dateOnly + "T00:00:00");
        const hh       = cap.openAt.slice(11, 13) || "00";
        const mm       = cap.openAt.slice(14, 16) || "00";
        const displayName = cap.title
          ? cap.title
          : cap.message.slice(0, 8) + (cap.message.length > 8 ? "…" : "");
        return {
          oaName:    trunc(`${displayName} · 时间胶囊`),
          oaTime:    `${dateOnly} ${hh}:${mm}`,
          mpName:    displayName,
          mpDate:    `${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`,
          daysUntil: days,
          effDays:   oaCfg.daysBefore,   // 时间胶囊使用全局配置
        };
      }
    }

    const info = await buildItemInfo();
    if (!info) return;
    if (!info.effDays.includes(info.daysUntil)) return; // 今天不在提醒范围内

    logger.info(
      { userId, itemType, itemId, daysUntil: info.daysUntil },
      "Immediate notify triggered — send hour already passed, sending now",
    );

    // ── OA 公众号模板消息 ──────────────────────────────────────────────────
    if (shouldOa && user.oaOpenId) {
      const token = await getAccessToken();
      if (token) {
        const ok = await sendOaTemplateMsg(token, oaCfg.templateId, user.oaOpenId, info.oaName, info.oaTime, {
          h5Url:          oaCfg.h5Url,
          mpLinkEnabled:  oaCfg.mpLinkEnabled,
          mpLinkAppId:    oaCfg.mpLinkAppId,
          mpLinkPagePath: oaCfg.mpLinkPagePath,
        });
        logger.info({ userId, itemType, itemId, ok }, "Immediate OA template msg sent");
      }
    }

    // ── 小程序订阅消息 ─────────────────────────────────────────────────────
    if (shouldMp && user.openId && !user.openId.startsWith("mock:") && user.mpSubscribed && user.mpSubscribeCount > 0) {
      const token = await getMpAccessToken();
      if (token) {
        const { ok, revoked } = await sendMpSubscribeMsg(
          token, mpCfg.templateId, user.openId, info.mpName, info.mpDate, mpCfg.tipText,
        );
        if (ok) {
          const newCount = Math.max(0, user.mpSubscribeCount - 1);
          await db.update(usersTable)
            .set({ mpSubscribeCount: newCount, mpSubscribed: newCount > 0 })
            .where(eq(usersTable.id, userId));
          logger.info({ userId, itemType, itemId }, "Immediate MP subscribe msg sent");
        } else if (revoked) {
          await db.update(usersTable)
            .set({ mpSubscribed: false, mpSubscribeCount: 0 })
            .where(eq(usersTable.id, userId));
        }
      }
    }
  } catch (err) {
    logger.error({ err, userId, itemType, itemId }, "Immediate notify error (non-fatal)");
  }
}
