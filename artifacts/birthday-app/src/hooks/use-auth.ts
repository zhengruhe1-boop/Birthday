import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetMe as useGeneratedGetMe,
  useMockLogin as useGeneratedMockLogin,
  useLogout as useGeneratedLogout
} from "@workspace/api-client-react";
import { z } from "zod";

export const TOKEN_KEY = "birthday_app_token";

export function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem(TOKEN_KEY));
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const { data: user, isLoading, error } = useGeneratedGetMe({
    request: { headers: getAuthHeaders() },
    query: {
      enabled: !!token,
      retry: false,
    }
  });

  const mockLogin = useGeneratedMockLogin({
    mutation: {
      onSuccess: (data) => {
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }
    }
  });

  const logout = useGeneratedLogout({
    mutation: {
      onSuccess: () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        queryClient.clear();
      }
    }
  });

  const performLogout = () => {
    if (token) {
      logout.mutate();
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      queryClient.clear();
    }
  };

  return {
    user,
    token,
    isLoading: isLoading && !!token,
    isAuthenticated: !!user && !!token,
    mockLogin,
    logout: performLogout,
    isError: !!error,
  };
}
