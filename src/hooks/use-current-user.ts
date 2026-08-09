import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const USER_ID_KEY = "devhabit:userId";
const DEVICE_ID_KEY = "devhabit:deviceId";

function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// No auth system — each browser is identified by a random deviceId cached
// in localStorage, and the backend looks up/creates one user per device.
// Reads happen inside useEffect (not the initializer) so this stays SSR-safe:
// localStorage doesn't exist during server rendering.
export function useCurrentUserId() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const getOrCreateDemoUser = useMutation(api.users.getOrCreateDemoUser);

  useEffect(() => {
    const cached = localStorage.getItem(USER_ID_KEY);
    if (cached) {
      setUserId(cached as Id<"users">);
      return;
    }
    getOrCreateDemoUser({ deviceId: getOrCreateDeviceId() }).then((id) => {
      localStorage.setItem(USER_ID_KEY, id);
      setUserId(id);
    });
  }, [getOrCreateDemoUser]);

  return userId;
}
