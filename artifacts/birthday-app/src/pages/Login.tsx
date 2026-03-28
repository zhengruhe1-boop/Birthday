import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { MessageCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export default function Login() {
  const [, setLocation] = useLocation();
  const { mockLogin, isAuthenticated } = useAuth();
  const [nickname, setNickname] = useState("");
  const [isDevMode, setIsDevMode] = useState(false);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  const handleMockLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    mockLogin.mutate({ data: { nickname } });
  };

  const handleWechatLogin = () => {
    // In a real app, this would redirect to WeChat OAuth
    // For this demo, we'll just toggle the dev mode to show mock login
    setIsDevMode(true);
  };

  return (
    <div className="app-container flex flex-col relative overflow-hidden bg-white">
      {/* Background Image using absolute positioning */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt="Warm elegant background" 
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/60 to-white"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col pt-24 px-6 pb-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center mt-12 mb-16"
        >
          <div className="w-24 h-24 rounded-3xl bg-white shadow-xl shadow-primary/20 flex items-center justify-center p-2 mb-6 transform -rotate-3">
            <img 
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="生日通 Logo" 
              className="w-full h-full object-contain rounded-2xl transform rotate-3"
            />
          </div>
          <h1 className="text-4xl font-display font-bold text-foreground mb-3 tracking-tight">生日通</h1>
          <p className="text-muted-foreground text-lg">记住每一个重要的日子</p>
        </motion.div>

        <div className="flex-1"></div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="w-full max-w-sm mx-auto space-y-4"
        >
          {!isDevMode ? (
            <>
              <Button 
                size="lg" 
                className="w-full bg-[#07C160] hover:bg-[#06ad56] text-white border-none shadow-lg shadow-[#07C160]/20 flex items-center gap-2"
                onClick={handleWechatLogin}
              >
                <MessageCircle className="w-5 h-5" />
                微信一键登录
              </Button>
              
              <div className="text-center mt-6">
                <button 
                  onClick={() => setIsDevMode(true)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                >
                  使用测试账号登录 (Dev Mode)
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleMockLogin} className="glass-panel p-6 rounded-3xl space-y-4">
              <h3 className="text-lg font-bold text-center mb-4">测试登录</h3>
              
              <Input 
                placeholder="输入昵称 (如: 测试用户)" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                icon={<User className="w-5 h-5" />}
                required
              />
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={mockLogin.isPending || !nickname.trim()}
              >
                {mockLogin.isPending ? "登录中..." : "进入应用"}
              </Button>
              
              <div className="text-center mt-4">
                <button 
                  type="button"
                  onClick={() => setIsDevMode(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  返回微信登录
                </button>
              </div>
            </form>
          )}
        </motion.div>
        
        <div className="mt-8 text-center text-xs text-muted-foreground">
          登录即代表同意 <a href="#" className="text-primary hover:underline">用户协议</a> 和 <a href="#" className="text-primary hover:underline">隐私政策</a>
        </div>
      </div>
    </div>
  );
}
