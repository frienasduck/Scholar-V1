/**
 * Secure storage (expo-secure-store → Android Keystore-backed storage).
 *
 * Holds ONLY the Scholar session token (the raw `scholar_session` cookie
 * value). Passwords are never stored anywhere in the app.
 */
import * as SecureStore from "expo-secure-store";

const SESSION_TOKEN_KEY = "scholar.sessionToken.v1";

export async function saveSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getStoredSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function clearStoredSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}
