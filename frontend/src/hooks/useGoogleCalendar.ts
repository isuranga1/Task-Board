import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api/client";
import type { GoogleCalendarStatus, GoogleEvent } from "../types";

/**
 * Owns the Google Calendar connection and the events for whatever window the
 * calendar is currently showing.
 *
 * Events are fetched per visible window rather than all at once: a Google
 * account with years of history would be a large and mostly wasted download,
 * and the API wants an explicit time range anyway.
 */
export function useGoogleCalendar(windowStart: Date | null, windowEnd: Date | null) {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api.getGoogleStatus());
    } catch {
      // A backend that can't answer /gcal/status shouldn't take the calendar
      // page down with it — task deadlines still render fine without Google.
      setStatus({
        configured: false,
        connected: false,
        account_email: null,
        calendars: [],
        selected_calendar_ids: [],
        error: "Couldn't reach the server to check the Google connection.",
      });
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Identifies the newest fetch so a slow response for a month you've already
  // paged away from can't overwrite the one you're actually looking at.
  const latestFetch = useRef(0);

  const connected = status?.connected ?? false;
  const selectedCount = status?.selected_calendar_ids.length ?? 0;
  const startKey = windowStart?.toISOString() ?? "";
  const endKey = windowEnd?.toISOString() ?? "";

  useEffect(() => {
    if (!connected || !windowStart || !windowEnd) {
      setEvents([]);
      return;
    }
    // No calendars ticked means nothing to show — skip the round trip.
    if (selectedCount === 0) {
      setEvents([]);
      return;
    }

    const fetchId = ++latestFetch.current;
    setLoadingEvents(true);
    setEventError(null);

    api
      .listGoogleEvents(windowStart, windowEnd)
      .then((data) => {
        if (fetchId !== latestFetch.current) return;
        setEvents(data);
      })
      .catch((err: unknown) => {
        if (fetchId !== latestFetch.current) return;
        setEvents([]);
        setEventError(err instanceof Error ? err.message : "Failed to load Google events");
      })
      .finally(() => {
        if (fetchId === latestFetch.current) setLoadingEvents(false);
      });
    // startKey/endKey are the stable string form of the Date props — depending
    // on the Date objects themselves would refetch on every render, since a
    // parent that builds `new Date(...)` inline creates a new identity each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, selectedCount, startKey, endKey]);

  const connect = useCallback(async () => {
    const { url } = await api.getGoogleAuthUrl();
    // Full-page navigation rather than a popup: Google blocks its consent
    // screen inside iframes, and popups get eaten by blockers often enough that
    // the redirect is the more reliable path. /gcal/callback sends us back.
    window.location.href = url;
  }, []);

  const disconnect = useCallback(async () => {
    await api.disconnectGoogle();
    setEvents([]);
    await refreshStatus();
  }, [refreshStatus]);

  const toggleCalendar = useCallback(
    async (calendarId: string, enabled: boolean) => {
      if (!status) return;
      const next = enabled
        ? [...new Set([...status.selected_calendar_ids, calendarId])]
        : status.selected_calendar_ids.filter((id) => id !== calendarId);

      // Optimistic: ticking a box should feel instant, and the only cost of
      // being wrong is a checkbox that flicks back when the server disagrees.
      const previous = status;
      setStatus({ ...status, selected_calendar_ids: next });
      try {
        setStatus(await api.setGoogleCalendars(next));
      } catch {
        setStatus(previous);
      }
    },
    [status]
  );

  return {
    status,
    events,
    loadingEvents,
    eventError,
    refreshStatus,
    connect,
    disconnect,
    toggleCalendar,
  };
}
