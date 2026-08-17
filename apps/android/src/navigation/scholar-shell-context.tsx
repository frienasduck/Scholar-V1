import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type ScholarShellContextValue = {
  drawerOpen: boolean;
  searchOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  openSearch: () => void;
  closeSearch: () => void;
};

const ScholarShellContext = createContext<ScholarShellContextValue | null>(null);

export function ScholarShellProvider({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const value = useMemo(() => ({ drawerOpen, searchOpen, openDrawer, closeDrawer, openSearch, closeSearch }), [drawerOpen, searchOpen, openDrawer, closeDrawer, openSearch, closeSearch]);
  return <ScholarShellContext.Provider value={value}>{children}</ScholarShellContext.Provider>;
}

export function useScholarShell(): ScholarShellContextValue {
  const value = useContext(ScholarShellContext);
  if (!value) throw new Error("useScholarShell must be used within ScholarShellProvider");
  return value;
}
