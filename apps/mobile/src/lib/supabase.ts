import * as FileSystem from "expo-file-system/legacy";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Supabase auth storage without `@react-native-async-storage/async-storage`.
 * AsyncStorage can fail in Expo Go (native module null / v3 "legacy storage" errors).
 * We persist key→value JSON in the app document directory via Expo FileSystem.
 */
const STORAGE_FILE = "salhantech-supabase-auth-kv.json";
const memoryKv = new Map<string, string>();

async function readKvFile(): Promise<Record<string, string>> {
  const base = FileSystem.documentDirectory;
  if (!base) return {};
  const path = `${base}${STORAGE_FILE}`;
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeKvFile(data: Record<string, string>): Promise<void> {
  const base = FileSystem.documentDirectory;
  if (!base) return;
  const path = `${base}${STORAGE_FILE}`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data));
}

const supabaseAuthStorage = {
  getItem: async (key: string) => {
    if (FileSystem.documentDirectory) {
      const kv = await readKvFile();
      return kv[key] ?? null;
    }
    return memoryKv.has(key) ? memoryKv.get(key)! : null;
  },
  setItem: async (key: string, value: string) => {
    if (FileSystem.documentDirectory) {
      const kv = await readKvFile();
      kv[key] = value;
      await writeKvFile(kv);
    } else {
      memoryKv.set(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (FileSystem.documentDirectory) {
      const kv = await readKvFile();
      delete kv[key];
      await writeKvFile(kv);
    } else {
      memoryKv.delete(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
