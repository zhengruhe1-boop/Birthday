import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Trash2, Heart, Timer, CalendarClock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/hooks/use-auth";

type EventType = "anniversary" | "countdown" | "other";

interface EventPayload {
  type: EventType;
  name: string;
  eventDate?: string;
  person?: string;
  reminderTime?: string;
}

const TYPE_META: Record<EventType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  anniversary: {
    label: "纪念日",
    icon: <Heart className="w-5 h-5" />,
    color: "text-rose-500",
    bg: "bg-rose-50",
  },
  countdown: {
    label: "倒数日",
    icon: <Timer className="w-5 h-5" />,
    color: "text-orange-500",
    bg: "bg-orange-50",
  },
  other: {
    label: "其它提醒",
    icon: <Sparkles className="w-5 h-5" />,
    color: "text-violet-500",
    bg: "bg-violet-50",
  },
};

const BASE = import.meta.env.BASE_URL;

async function apiGet(path: string) {
  const r = await fetch(`${BASE}${path}`, { headers: getAuthHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPost(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiPut(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function apiDelete(path: string) {
  const r = await fetch(`${BASE}${path}`, { method: "DELETE", headers: getAuthHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function EventForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // /event/new/:type  or  /event/:id
  const [matchNew, paramsNew] = useRoute("/event/new/:type");
  const [matchEdit, paramsEdit] = useRoute("/event/:id");

  const isNew = matchNew;
  const rawType = paramsNew?.type as EventType | undefined;
  const editId = matchEdit && !matchNew ? Number(paramsEdit?.id) : null;

  const [eventType, setEventType] = useState<EventType>(rawType ?? "anniversary");
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [person, setPerson] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Load existing event for edit
  useEffect(() => {
    if (!editId) return;
    setFetching(true);
    apiGet(`api/events/${editId}`)
      .then((e) => {
        setEventType(e.type);
        setName(e.name ?? "");
        setEventDate(e.eventDate ?? "");
        setPerson(e.person ?? "");
        setReminderTime(e.reminderTime ?? "");
      })
      .catch(() => toast({ title: "加载失败", variant: "destructive" }))
      .finally(() => setFetching(false));
  }, [editId]);

  const meta = TYPE_META[eventType];

  const validate = () => {
    if (!name.trim()) { toast({ title: "请填写名称", variant: "destructive" }); return false; }
    if ((eventType === "anniversary" || eventType === "countdown") && !eventDate) {
      toast({ title: "请选择日期", variant: "destructive" }); return false;
    }
    if (eventType === "other" && !reminderTime) {
      toast({ title: "请填写提醒时间", variant: "destructive" }); return false;
    }
    return true;
  };

  const buildPayload = (): EventPayload => ({
    type: eventType,
    name: name.trim(),
    eventDate: eventDate || undefined,
    person: person.trim() || undefined,
    reminderTime: reminderTime || undefined,
  });

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (isNew) {
        await apiPost("api/events", buildPayload());
        toast({ title: "添加成功" });
      } else {
        await apiPut(`api/events/${editId}`, buildPayload());
        toast({ title: "保存成功" });
      }
      setLocation("/");
    } catch {
      toast({ title: "保存失败，请重试", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    setDeleting(true);
    try {
      await apiDelete(`api/events/${editId}`);
      toast({ title: "已删除" });
      setLocation("/");
    } catch {
      toast({ title: "删除失败", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (fetching) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="app-container flex flex-col bg-slate-50/50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border/50 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className={`w-8 h-8 rounded-xl ${meta.bg} flex items-center justify-center ${meta.color}`}>
            {meta.icon}
          </div>
          <h1 className="text-lg font-bold">
            {isNew ? `添加${meta.label}` : `编辑${meta.label}`}
          </h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-y-auto pb-28 space-y-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

          {/* 纪念日名称 / 事件名称 */}
          <div className="bg-white rounded-2xl border border-border/50 p-5 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {eventType === "anniversary" ? "纪念日名称" : "事件名称"}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <Input
                placeholder={
                  eventType === "anniversary" ? "例如：结婚纪念日" :
                  eventType === "countdown"   ? "例如：高考" :
                                                "例如：复查体检"
                }
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            {/* 纪念日：日期 + 人物 */}
            {eventType === "anniversary" && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    纪念日日期 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    相关人物 <span className="text-muted-foreground font-normal text-xs">（选填）</span>
                  </label>
                  <Input
                    placeholder="例如：小明 & 小红"
                    value={person}
                    onChange={e => setPerson(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* 倒数日：事件日期 */}
            {eventType === "countdown" && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  事件日期 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full"
                />
              </div>
            )}

            {/* 其它：提醒时间 */}
            {eventType === "other" && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  提醒时间 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={reminderTime}
                  onChange={e => setReminderTime(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* 预览卡 */}
          {name.trim() && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-2xl border p-4 ${meta.bg} flex items-center gap-3`}
            >
              <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center ${meta.color} shadow-sm`}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {eventType === "anniversary" && eventDate
                    ? `${eventDate}${person ? ` · ${person}` : ""}`
                    : eventType === "countdown" && eventDate
                    ? `目标日期：${eventDate}`
                    : eventType === "other" && reminderTime
                    ? `提醒时间：${reminderTime}`
                    : "填写完整后预览"}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-xl border-t border-border/50 px-4 py-4 flex gap-3">
        {!isNew && (
          <Button
            variant="outline"
            className="flex-shrink-0 text-red-500 border-red-200 hover:bg-red-50"
            onClick={handleDelete}
            disabled={deleting || loading}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        <Button className="flex-1" onClick={handleSave} disabled={loading || deleting}>
          <Save className="w-4 h-4 mr-2" />
          {loading ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
