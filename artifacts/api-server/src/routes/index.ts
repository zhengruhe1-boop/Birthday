import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import contactsRouter from "./contacts.js";
import uploadRouter from "./upload.js";
import remindersRouter from "./reminders.js";
import adminRouter from "./admin.js";
import eventsRouter from "./events.js";
import shareRouter from "./share.js";
import wechatOaRouter from "./wechat-oa.js";
import fortuneRouter from "./fortune.js";
import mpToolsRouter from "./mp-tools.js";
import quotaRouter from "./quota.js";
import capsulesRouter from "./time-capsules.js";
import trackRouter from "./track.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/contacts", contactsRouter);
router.use("/upload", uploadRouter);
router.use("/reminders", remindersRouter);
router.use("/admin", adminRouter);
router.use("/events", eventsRouter);
router.use("/share", shareRouter);
router.use("/wechat/oa", wechatOaRouter);
router.use("/fortune", fortuneRouter);
router.use("/mp-tools", mpToolsRouter);
router.use("/quota", quotaRouter);
router.use("/capsules", capsulesRouter);
router.use("/track", trackRouter);

export default router;
