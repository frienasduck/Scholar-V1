"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useGroupRoom, type GroupRoomController } from "./use-room";

const GroupSessionContext = createContext<GroupRoomController | null>(null);

export function GroupSessionProvider({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const controller = useGroupRoom(roomId);
  return (
    <GroupSessionContext.Provider value={controller}>
      {children}
    </GroupSessionContext.Provider>
  );
}

export function useGroupSession() {
  const value = useContext(GroupSessionContext);
  if (!value)
    throw new Error("useGroupSession must be used inside GroupSessionProvider");
  return value;
}
