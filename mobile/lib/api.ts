import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const TOKEN_KEY = "mandate_token";

/** Host Expo Go used to load this bundle, e.g. 172.20.10.12:8081. */
function expoDevHost(): string | null {
  const raw = Constants.expoGoConfig?.debuggerHost ?? Constants.expoConfig?.hostUri ?? "";
  const host = raw.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

/**
 * Local Next.js app. EXPO_PUBLIC_API_URL=http://localhost:3000 means this machine.
 * In Expo Go, localhost is the phone, so the request goes to the same computer that served the bundle, port 3000.
 */
export function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  const fromExtra = (Constants.expoConfig?.extra?.apiUrl as string | undefined)?.trim().replace(/\/$/, "");
  const configured = fromEnv || fromExtra || "http://localhost:3000";
  const local = configured.match(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::(\d+))?$/);
  if (!local) return configured;
  const port = local[1] ?? "3000";
  const host = expoDevHost();
  if (host) return `http://${host}:${port}`;
  if (Platform.OS === "android") return `http://10.0.2.2:${port}`;
  return `http://localhost:${port}`;
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
