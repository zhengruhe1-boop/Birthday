import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, UserPlus, Image as ImageIcon, Trash2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { useCreateContact, useUpdateContact, useContact, useDeleteContact } from "@/hooks/use-contacts";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

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
    }
  }, [contact, isEdit, form]);

  // Auth guard
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isAuthLoading, setLocation]);

  const onSubmit = async (data: FormValues) => {
    try {
      const payload = {
        ...data,
        birthYear: data.birthYear ? Number(data.birthYear) : null,
        reminderEmail: data.reminderEmail || null,
        relation: data.relation || null,
        hometown: data.hometown || null,
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
  if (isEdit && isContactLoading) return <div className="app-container flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div></div>;

  const isPending = createContact.isPending || updateContact.isPending;

  // Month/Day options
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

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
          
          {/* Avatar Profile */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-24 h-24">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-rose-100 to-red-50 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden">
                {contact?.avatarUrl ? (
                  <img src={contact.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <img src={`${import.meta.env.BASE_URL}images/avatar-placeholder.png`} alt="Avatar Placeholder" className="w-full h-full object-cover opacity-60" />
                )}
              </div>
              <button type="button" className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-md border border-border flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors">
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
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
              {form.formState.errors.reminderEmail && <p className="text-xs text-destructive mt-1">{form.formState.errors.reminderEmail.message}</p>}
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
          disabled={isPending}
        >
          {isPending ? "保存中..." : "保存记录"}
        </Button>
      </div>
    </div>
  );
}
