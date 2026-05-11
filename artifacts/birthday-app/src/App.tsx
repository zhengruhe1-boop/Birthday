import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ContactForm from "./pages/ContactForm";
import EventForm from "./pages/EventForm";
import Admin from "./pages/Admin";
import Tools from "./pages/Tools";
import Fortune from "./pages/Fortune";
import Profile from "./pages/Profile";
import BottomNav from "./components/BottomNav";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const BOTTOM_NAV_PATHS = ["/", "/tools", "/profile"];

function AppShell() {
  const [location] = useLocation();
  const showNav = BOTTOM_NAV_PATHS.includes(location);

  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tools" component={Tools} />
        <Route path="/fortune" component={Fortune} />
        <Route path="/profile" component={Profile} />
        <Route path="/login" component={Login} />
        <Route path="/contact/:id" component={ContactForm} />
        <Route path="/event/new/:type" component={EventForm} />
        <Route path="/event/:id" component={EventForm} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
      {showNav && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppShell />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
