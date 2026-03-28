import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, LogOut, CalendarHeart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUpcomingBirthdays, useContacts } from "@/hooks/use-contacts";
import { useAuth } from "@/hooks/use-auth";
import { ContactCard } from "@/components/ContactCard";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, logout, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [search, setSearch] = useState("");
  
  // Queries
  const { data: upcoming, isLoading: isUpcomingLoading } = useUpcomingBirthdays();
  const { data: searchResults, isLoading: isSearchLoading } = useContacts(search.trim() ? search : undefined);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isAuthLoading, setLocation]);

  if (isAuthLoading || !user) {
    return <div className="app-container flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div></div>;
  }

  const isSearching = search.trim().length > 0;
  const showLoading = isSearching ? isSearchLoading : isUpcomingLoading;

  return (
    <div className="app-container flex flex-col bg-slate-50/50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border/50 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CalendarHeart className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold font-display tracking-tight">生日通</h1>
          </div>
          
          <button 
            onClick={logout}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        
        <Input
          placeholder="搜索亲友..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="w-5 h-5" />}
          className="bg-gray-100/80 border-transparent shadow-inner focus-visible:bg-white focus-visible:border-primary/30"
        />
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 overflow-y-auto pb-28">
        <AnimatePresence mode="wait">
          {showLoading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 h-24 animate-pulse border border-border flex items-center gap-4">
                  <div className="w-14 h-14 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : isSearching ? (
            <motion.div 
              key="search"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-2">搜索结果 ({searchResults?.length || 0})</h2>
              {searchResults?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">没有找到相关亲友</div>
              ) : (
                searchResults?.map((contact, i) => (
                  <ContactCard key={contact.id} contact={contact} index={i} />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="upcoming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {(!upcoming?.imminent.length && !upcoming?.soon.length && !upcoming?.monthly.length) && (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="w-24 h-24 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-6">
                    <CalendarHeart className="w-12 h-12" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">还没有添加任何亲友</h3>
                  <p className="text-muted-foreground text-sm mb-6">点击右下角按钮，记录重要的日子吧</p>
                </div>
              )}

              {upcoming?.imminent && upcoming.imminent.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-primary mb-3 px-2 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                    即将过生日 <span className="text-xs font-normal bg-primary/10 px-2 py-0.5 rounded-full">{upcoming.imminent.length}</span>
                  </h2>
                  <div className="space-y-3">
                    {upcoming.imminent.map((c, i) => <ContactCard key={c.id} contact={c} index={i} />)}
                  </div>
                </section>
              )}

              {upcoming?.soon && upcoming.soon.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-orange-500 mb-3 px-2 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                    近期过生日 <span className="text-xs font-normal bg-orange-100 px-2 py-0.5 rounded-full">{upcoming.soon.length}</span>
                  </h2>
                  <div className="space-y-3">
                    {upcoming.soon.map((c, i) => <ContactCard key={c.id} contact={c} index={i} />)}
                  </div>
                </section>
              )}

              {upcoming?.monthly && upcoming.monthly.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-slate-500 mb-3 px-2 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-slate-400 rounded-full"></span>
                    一个月后生日 <span className="text-xs font-normal bg-slate-200 px-2 py-0.5 rounded-full">{upcoming.monthly.length}</span>
                  </h2>
                  <div className="space-y-3">
                    {upcoming.monthly.map((c, i) => <ContactCard key={c.id} contact={c} index={i} />)}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FAB */}
      <div className="fixed bottom-6 right-0 left-0 max-w-md mx-auto pointer-events-none px-6 flex justify-end z-50">
        <Link href="/contact/new" className="pointer-events-auto">
          <button className="h-14 w-14 rounded-full bg-gradient-to-r from-primary to-primary/80 text-white shadow-[0_8px_30px_rgba(225,29,72,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
            <Plus className="h-7 w-7" />
          </button>
        </Link>
      </div>
    </div>
  );
}
