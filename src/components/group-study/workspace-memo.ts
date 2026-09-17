import type { RoomSnapshot } from "@/lib/group-study/types";
import type { GroupRoomController } from "./use-room";

/** Compare only the slices a workspace reads; callbacks use the live snapshot getter. */
export function sameWorkspace(
  a: GroupRoomController,
  b: GroupRoomController,
  slices: Array<keyof RoomSnapshot>,
  roomFields: Array<keyof RoomSnapshot["room"]>,
  actions: string[] = [],
) {
  if (
    a.action !== b.action ||
    a.refresh !== b.refresh ||
    a.getSnapshot !== b.getSnapshot ||
    a.setError !== b.setError
  )
    return false;
  const x = a.snapshot,
    y = b.snapshot;
  if (!x || !y) return x === y;
  if (x.room.id !== y.room.id || x.me !== y.me) return false;
  if (
    slices.some((key) => x[key] !== y[key]) ||
    roomFields.some((key) => x.room[key] !== y.room[key])
  )
    return false;
  return actions.every(
    (action) =>
      a.busyKeys.some((key) => key.startsWith(action + ":")) ===
      b.busyKeys.some((key) => key.startsWith(action + ":")),
  );
}
