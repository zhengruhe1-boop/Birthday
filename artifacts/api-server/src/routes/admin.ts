import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, contactsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const key = req.headers["x-admin-key"];
  const adminKey = process.env.ADMIN_KEY || "birthday-admin-2024";
  if (key !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// GET /api/admin/stats — all users with their contact counts and contact list
router.get("/stats", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    const contacts = await db.select().from(contactsTable).orderBy(contactsTable.createdAt);

    const result = users.map((u) => {
      const userContacts = contacts.filter((c) => c.userId === u.id).map((c) => ({
        id: c.id,
        name: c.name,
        birthdayMonth: c.birthdayMonth,
        birthdayDay: c.birthdayDay,
        birthYear: c.birthYear,
        birthdayLunar: c.birthdayLunar,
        relation: c.relation,
        createdAt: c.createdAt,
      }));
      return {
        id: u.id,
        openId: u.openId,
        nickname: u.nickname,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt,
        contactCount: userContacts.length,
        contacts: userContacts,
      };
    });

    res.json({
      totalUsers: users.length,
      totalContacts: contacts.length,
      users: result,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
