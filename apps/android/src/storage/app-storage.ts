/**
 * Non-sensitive app preferences (AsyncStorage). Sensitive data (session
 * token) lives in src/storage/secure.ts instead.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL_OVERRIDE_KEY = "scholar.apiUrlOverride.v1";
const LAST_EMAIL_KEY = "scholar.lastEmail.v1";

export async function getApiUrlOverride(): Promise<string | null> {
  return AsyncStorage.getItem(API_URL_OVERRIDE_KEY);
}

export async function setApiUrlOverride(url: string): Promise<void> {
  await AsyncStorage.setItem(API_URL_OVERRIDE_KEY, url.trim().replace(/\/+$/, ""));
}

export async function clearApiUrlOverride(): Promise<void> {
  await AsyncStorage.removeItem(API_URL_OVERRIDE_KEY);
}

export async function getLastEmail(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_EMAIL_KEY);
}

export async function setLastEmail(email: string): Promise<void> {
  await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
}
