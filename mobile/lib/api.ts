import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const TOKEN_KEY = "mandate_token";

/**
 * Mandate API base URL. Set EXPO_PUBLIC_API_URL in mobile/.env (copy from .env.example).
 * Dev fallbacks: iOS Simulator → localhost:3000; Android emulator → 10.0.2.2:3000.
 */
export function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const fromExtra = (Constants.expoConfig?.extra?.apiUrl as string | undefined)?.trim();
  if (fromExtra) return fromExtra.replace(/\/$/, "");
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function api<T = unknown>(path: string, body?: unknown, method?: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${apiBase()}${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      "X-Mandate-Client": "mobile",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const money = (n: number) => `${n < 0 ? "minus " : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
