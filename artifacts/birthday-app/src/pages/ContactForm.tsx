import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Camera, Trash2, X, Mail, CheckCircle, RefreshCw, Globe, Landmark } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { useCreateContact, useUpdateContact, useContact, useDeleteContact } from "@/hooks/use-contacts";
import { useAuth, getAuthHeaders } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { BirthdayEvent } from "@workspace/api-client-react";

const contactSchema = z.object({
  name: z.string().min(1, "请输入姓名"),
  gender: z.enum(["male", "female"]).nullable().optional(),
  birthdayMonth: z.coerce.number().min(1).max(12),
  birthdayDay: z.coerce.number().min(1).max(31),
  birthdayLunar: z.boolean(),
  birthYear: z.coerce.number().min(1900).max(new Date().getFullYear()).optional().or(z.literal("")),
  relation: z.string().optional(),
  hometown: z.string().optional(),
  reminderEmail: z.string().email("邮箱格式不正确").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof contactSchema>;

export default function ContactForm() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/contact/:id");
  const isEdit = match && params?.id !== "new";
  const contactId = isEdit ? parseInt(params.id!, 10) : null;

  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const { data: contact, isLoading: isContactLoading } = useContact(contactId);
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [testEmailStatus, setTestEmailStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [testEmailMsg, setTestEmailMsg] = useState("");

  const [events, setEvents] = useState<BirthdayEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const eventsPollerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      gender: null,
      birthdayMonth: new Date().getMonth() + 1,
      birthdayDay: new Date().getDate(),
      birthdayLunar: false,
      birthYear: "",
      relation: "",
      hometown: "",
      reminderEmail: "",
    }
  });

  useEffect(() => {
    if (contact && isEdit) {
      form.reset({
        name: contact.name,
        gender: contact.gender,
        birthdayMonth: contact.birthdayMonth,
        birthdayDay: contact.birthdayDay,
        birthdayLunar: contact.birthdayLunar,
        birthYear: contact.birthYear || "",
        relation: contact.relation || "",
        hometown: contact.hometown || "",
        reminderEmail: contact.reminderEmail || "",
      });
      setAvatarUrl(contact.avatarUrl ?? null);
    }
  }, [contact, isEdit, form]);

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isAuthLoading, setLocation]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setAvatarUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`${import.meta.env.BASE_URL}api/upload`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "上传失败" }));
        throw new Error(err.error || "上传失败");
      }

      const { url } = await res.json();
      setAvatarUrl(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "上传失败，请重试";
      setAvatarError(msg);
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    setAvatarError(null);
  };

  // Populate events from contact data
  useEffect(() => {
    if (contact?.birthdayEvents && contact.birthdayEvents.length > 0) {
      setEvents(contact.birthdayEvents as BirthdayEvent[]);
      if (eventsPollerRef.current) clearTimeout(eventsPollerRef.current);
    } else if (isEdit && contact && contact.birthdayEvents?.length === 0) {
      // Events not yet generated — poll every 5s until they appear
      const poll = () => {
        eventsPollerRef.current = setTimeout(async () => {
          try {
            const res = await fetch(`${import.meta.env.BASE_URL}api/contacts/${contactId}`, {
              headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.birthdayEvents && data.birthdayEvents.length > 0) {
              setEvents(data.birthdayEvents);
            } else {
              poll();
            }
          } catch {
            // stop polling on error
          }
        }, 5000);
      };
      poll();
    }
    return () => {
      if (eventsPollerRef.current) clearTimeout(eventsPollerRef.current);
    };
  }, [contact?.birthdayEvents?.length, isEdit, contactId]);

  const handleGenerateEvents = useCallback(async () => {
    if (!contactId) return;
    setEventsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/contacts/${contactId}/birthday-events`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.events) setEvents(data.events);
    } catch {
      // ignore
    } finally {
      setEventsLoading(false);
    }
  }, [contactId]);

  const handleSendTestEmail = async () => {
    if (!contactId) return;
    setTestEmailStatus("sending");
    setTestEmailMsg("");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/reminders/test/${contactId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发送失败");
      setTestEmailStatus("success");
      setTestEmailMsg(data.message || "邮件已发送");
      setTimeout(() => setTestEmailStatus("idle"), 4000);
    } catch (err: unknown) {
      setTestEmailStatus("error");
      setTestEmailMsg(err instanceof Error ? err.message : "发送失败");
      setTimeout(() => setTestEmailStatus("idle"), 4000);
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      const payload = {
        ...data,
        birthYear: data.birthYear ? Number(data.birthYear) : null,
        reminderEmail: data.reminderEmail || null,
        relation: data.relation || null,
        hometown: data.hometown || null,
        avatarUrl: avatarUrl ?? null,
      };

      if (isEdit && contactId) {
        await updateContact.mutateAsync({ id: contactId, data: payload });
      } else {
        await createContact.mutateAsync({ data: payload });
      }
      setLocation("/");
    } catch (error) {
      console.error("Form submission failed:", error);
      alert("保存失败，请检查填写内容");
    }
  };

  const handleDelete = async () => {
    if (confirm("确定要删除这位亲友的生日记录吗？")) {
      if (contactId) {
        await deleteContact.mutateAsync({ id: contactId });
        setLocation("/");
      }
    }
  };

  if (isAuthLoading) return null;
  if (isEdit && isContactLoading) return (
    <div className="app-container flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
    </div>
  );

  const isPending = createContact.isPending || updateContact.isPending;
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  const displayAvatar = avatarUrl;

  return (
    <div className="app-container flex flex-col bg-slate-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border/50 px-4 pt-12 pb-4 flex items-center justify-between">
        <button
          onClick={() => setLocation("/")}
          className="p-2 -ml-2 text-foreground hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">
          {isEdit ? "编辑亲友信息" : "添加亲友"}
        </h1>
        <div className="w-10">
          {isEdit && (
            <button
              onClick={handleDelete}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-y-auto pb-24">
        <form id="contact-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Avatar Upload */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-24 h-24 group">
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={avatarUploading}
                className="w-full h-full rounded-full bg-gradient-to-tr from-rose-100 to-red-50 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden focus:outline-none"
              >
                {displayAvatar ? (
                  <img src={displayAvatar} alt="头像" className="w-full h-full object-cover" />
                ) : avatarUploading ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors">
                    <Camera className="w-8 h-8" />
                    <span className="text-[10px] font-medium">上传头像</span>
                  </div>
                )}
              </button>

              {displayAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full shadow border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {!displayAvatar && !avatarUploading && (
                <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full shadow-md flex items-center justify-center text-white pointer-events-none">
                  <Camera className="w-4 h-4" />
                </div>
              )}
            </div>

            {avatarError && (
              <p className="text-xs text-destructive mt-2 text-center">{avatarError}</p>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              {displayAvatar ? "点击头像可重新上传" : "点击上传头像（选填）"}
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Basic Info Card */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border/50 space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">基本信息</h2>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">姓名 <span className="text-destructive">*</span></label>
              <Input
                {...form.register("name")}
                placeholder="例如: 妈妈"
                className={cn(form.formState.errors.name && "border-destructive")}
              />
              {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">性别</label>
              <Controller
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => field.onChange("male")}
                      className={cn(
                        "flex-1 py-3 rounded-xl border-2 transition-all font-medium flex items-center justify-center gap-2",
                        field.value === "male"
                          ? "border-blue-500 bg-blue-50 text-blue-600"
                          : "border-border bg-white text-muted-foreground hover:bg-gray-50"
                      )}
                    >
                      <span>👨</span> 男
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange("female")}
                      className={cn(
                        "flex-1 py-3 rounded-xl border-2 transition-all font-medium flex items-center justify-center gap-2",
                        field.value === "female"
                          ? "border-pink-500 bg-pink-50 text-pink-600"
                          : "border-border bg-white text-muted-foreground hover:bg-gray-50"
                      )}
                    >
                      <span>👩</span> 女
                    </button>
                  </div>
                )}
              />
            </div>
          </div>

          {/* Birthday Card */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border/50 space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">生日信息</h2>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">历法类型</label>
              <Controller
                control={form.control}
                name="birthdayLunar"
                render={({ field }) => (
                  <div className="bg-gray-100 p-1 rounded-xl flex">
                    <button
                      type="button"
                      onClick={() => field.onChange(false)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                        !field.value ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      公历 (阳历)
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange(true)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                        field.value ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      农历 (阴历)
                    </button>
                  </div>
                )}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-1.5 block">月份</label>
                <SelectNative {...form.register("birthdayMonth")}>
                  {months.map(m => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </SelectNative>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground mb-1.5 block">日期</label>
                <SelectNative {...form.register("birthdayDay")}>
                  {daysInMonth.map(d => (
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </SelectNative>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">出生年份 <span className="text-muted-foreground font-normal">(选填, 用于计算年龄)</span></label>
              <Input
                type="number"
                {...form.register("birthYear")}
                placeholder="例如: 1990"
              />
            </div>
          </div>

          {/* Birthday Events Card — only shown when editing */}
          {isEdit && (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">生日那天的历史</h2>
                <button
                  type="button"
                  onClick={handleGenerateEvents}
                  disabled={eventsLoading}
                  className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                  title="重新生成"
                >
                  <RefreshCw className={cn("w-4 h-4", eventsLoading && "animate-spin")} />
                </button>
              </div>

              {events.length > 0 ? (
                <div className="space-y-3">
                  {events.map((ev, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className={cn(
                        "mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold",
                        ev.category === "中国" ? "bg-rose-500" : "bg-blue-500"
                      )}>
                        {ev.category === "中国" ? <Landmark className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            ev.category === "中国" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
                          )}>
                            {ev.category}
                          </span>
                          <span className="text-xs text-muted-foreground">{ev.year}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{ev.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ev.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : eventsLoading ? (
                <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <p className="text-sm">AI 正在查阅历史档案…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
                  <p className="text-sm">AI 正在生成历史大事，稍候刷新…</p>
                  <button
                    type="button"
                    onClick={handleGenerateEvents}
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    立即生成
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Extra Info Card */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border/50 space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">其他信息 <span className="text-xs font-normal normal-case">(选填)</span></h2>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">关系</label>
              <Input {...form.register("relation")} placeholder="例如：朋友、同事、家人" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">家乡</label>
              <Input {...form.register("hometown")} placeholder="例如：北京" />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">邮箱提醒</label>
              <Input
                type="email"
                {...form.register("reminderEmail")}
                placeholder="输入邮箱，提前1天发送提醒"
                className={cn(form.formState.errors.reminderEmail && "border-destructive")}
              />
              {form.formState.errors.reminderEmail && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.reminderEmail.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">
                系统每天早上 8 点自动检查，提前 1 天发送邮件提醒
              </p>

              {isEdit && contact?.reminderEmail && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={testEmailStatus === "sending"}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition-all",
                      testEmailStatus === "success"
                        ? "border-green-300 bg-green-50 text-green-600"
                        : testEmailStatus === "error"
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                    )}
                  >
                    {testEmailStatus === "sending" ? (
                      <><div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" /> 发送中...</>
                    ) : testEmailStatus === "success" ? (
                      <><CheckCircle className="w-4 h-4" /> {testEmailMsg}</>
                    ) : testEmailStatus === "error" ? (
                      <><Mail className="w-4 h-4" /> {testEmailMsg}</>
                    ) : (
                      <><Mail className="w-4 h-4" /> 发送一封测试提醒邮件</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </main>

      {/* Footer Action */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/80 backdrop-blur-md border-t border-border z-40">
        <Button
          type="submit"
          form="contact-form"
          className="w-full h-14 text-lg font-bold rounded-2xl"
          disabled={isPending || avatarUploading}
        >
          {isPending ? "保存中..." : avatarUploading ? "图片上传中..." : "保存记录"}
        </Button>
      </div>
    </div>
  );
}
