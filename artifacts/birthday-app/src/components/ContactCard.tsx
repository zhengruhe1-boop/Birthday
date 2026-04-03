import React from "react";
import { Link } from "wouter";
import { User, Gift, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getZodiacSign } from "@/lib/zodiac";
import type { Contact } from "@workspace/api-client-react";
import { motion } from "framer-motion";

interface ContactCardProps {
  contact: Contact;
  index: number;
}

export function ContactCard({ contact, index }: ContactCardProps) {
  const isImminent = contact.daysUntilBirthday <= 7;
  const isSoon = contact.daysUntilBirthday > 7 && contact.daysUntilBirthday <= 30;
  const zodiac = getZodiacSign(contact.birthdayMonth, contact.birthdayDay);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link href={`/contact/${contact.id}`} className="block w-full">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-50/50 hover:shadow-md hover:border-primary/20 transition-all duration-300 flex items-center gap-4 group">
          
          {/* Avatar */}
          <div className={cn(
            "h-14 w-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 overflow-hidden",
            contact.avatarUrl ? "bg-transparent" : "bg-gradient-to-br from-primary/10 to-accent/10 text-primary"
          )}>
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt={contact.name} className="h-full w-full object-cover" />
            ) : (
              contact.name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {contact.name}
              </h3>
              {zodiac && (
                <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                  {zodiac.symbol} {zodiac.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span className={cn(
                "inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-medium",
                contact.gender === "male" ? "bg-blue-50 text-blue-500" : 
                contact.gender === "female" ? "bg-pink-50 text-pink-500" : "bg-gray-100 text-gray-500"
              )}>
                {contact.gender === "male" ? "👨" : contact.gender === "female" ? "👩" : "👤"}
              </span>
              
              <span className="flex items-center gap-1 text-xs font-medium text-foreground/80 bg-secondary/50 px-2 py-0.5 rounded-full">
                {contact.birthdayLunar ? "农历" : "公历"} {contact.birthdayDisplay}
              </span>

              {contact.age !== null && contact.age !== undefined && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  距 {contact.age} 岁
                </span>
              )}
            </div>
          </div>

          {/* Days Left Badge */}
          <div className="flex flex-col items-end flex-shrink-0 text-right">
            <div className={cn(
              "px-3 py-1.5 rounded-xl font-bold text-sm shadow-sm transition-transform group-hover:scale-105",
              isImminent 
                ? "bg-gradient-to-r from-primary to-accent text-white shadow-primary/20" 
                : isSoon 
                  ? "bg-orange-100 text-orange-600 border border-orange-200" 
                  : "bg-gray-100 text-gray-600 border border-gray-200"
            )}>
              {contact.daysUntilBirthday === 0 ? "今天!" : 
               contact.daysUntilBirthday === 1 ? "明天" : 
               `${contact.daysUntilBirthday} 天后`}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
