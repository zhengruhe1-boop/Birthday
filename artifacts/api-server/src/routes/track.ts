import { Router, type Request, type Response } from "express";
import { db, analyticsEventsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/", (req: Request, res: Response) => {
  res.status(204).end();

  const { eventType, page, token } = (req.body ?? {}) as {
    eventType?: string;
    page?: string;
    token?: string;
  };

  if (!eventType || typeof eventType !== "string") return;

  (async () => {
    try {
      let userId: number | null = null;
      if (token && typeof token === "string") {
        const rows = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.sessionToken, token))
          .limit(1);
        if (rows[0]) userId = rows[0].id;
      }

      await db.insert(analyticsEventsTable).values({
        userId: userId ?? undefined,
        eventType: eventType.slice(0, 50),
        page: page ? String(page).slice(0, 100) : null,
      });
    } catch {
      // silently ignore — tracking must never impact user experience
    }
  })();
});

export default router;
