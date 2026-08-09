import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";

// Reports the browser's UTC offset to the backend so GitHub commit timestamps
// can be bucketed by the developer's own clock. Without it everything is
// bucketed as UTC, which mislabels the whole day for anyone far from Greenwich.
//
// Date.getTimezoneOffset() counts minutes to ADD to local time to reach UTC, so
// UTC+6:30 reports -390. The sign is flipped here so the stored value reads as
// "minutes ahead of UTC".
export function useTimezoneSync() {
  const user = useQuery(api.users.getCurrentUser);
  const setTimezoneOffset = useMutation(api.users.setTimezoneOffset);

  useEffect(() => {
    if (!user) return;
    const current = -new Date().getTimezoneOffset();
    // Re-sends on change so travel or a DST shift is picked up.
    if (user.timezoneOffsetMinutes === current) return;
    void setTimezoneOffset({ timezoneOffsetMinutes: current });
  }, [user, setTimezoneOffset]);
}
