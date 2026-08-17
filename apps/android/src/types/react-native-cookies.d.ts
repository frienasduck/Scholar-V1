/**
 * Minimal type declarations for react-native-cookies (the package ships no
 * TypeScript types). Only the APIs used by the Scholar API client are typed.
 */
declare module "react-native-cookies" {
  export interface Cookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: string;
    secure?: boolean;
    httpOnly?: boolean;
  }

  export interface CookieSetOptions {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    version?: string;
    expires?: string;
  }

  export interface CookieManagerStatic {
    /** Set a cookie for a domain. */
    set(cookie: CookieSetOptions, useWebKit?: boolean): Promise<boolean>;
    /** Get all cookies for a URL (origin). */
    get(url: string, useWebKit?: boolean): Promise<Record<string, Cookie>>;
    /** Clear every cookie (native cookie store). */
    clearAll(useWebKit?: boolean): Promise<boolean>;
    /** Persist cookies from a raw Set-Cookie header. */
    setFromResponse(url: string, cookie: string): Promise<boolean>;
    /** Read cookies from a raw response. */
    getFromResponse(url: string): Promise<Record<string, Cookie>>;
  }

  const CookieManager: CookieManagerStatic;
  export default CookieManager;
}
