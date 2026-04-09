import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import contactsRouter from "./contacts.js";
import uploadRouter from "./upload.js";
import remindersRouter from "./reminders.js";
import adminRouter from "./admin.js";
import eventsRouter from "./events.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/contacts", contactsRouter);
router.use("/upload", uploadRouter);
router.use("/reminders", remindersRouter);
router.use("/admin", adminRouter);
router.use("/events", eventsRouter);

export default router;
