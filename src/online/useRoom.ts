/**
 * Live view of an online room: loads it, reloads whenever the room row changes
 * (every lobby change and every move bumps its version) and tracks which phones
 * are connected right now (Realtime Presence). Emoji reactions travel between phones
 * over the same channel (Realtime Broadcast) and are never stored.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRoom, type RoomSnapshot } from "./api";
import { signIn } from "./client";
import { type OnlineError, toOnlineError } from "./errors";
import { parseReaction, type Reaction, type ReactionEmoji } from "./game";

const POLL_MS = 4000;
/** How long a reaction stays on screen. */
const REACTION_MS = 2500;

export interface ShownReaction extends Reaction {
  id: number;
}

export interface RoomView {
  /** Null while loading, or once the room no longer exists for this phone. */
  snapshot: RoomSnapshot | null;
  loading: boolean;
  error: OnlineError | null;
  /** This phone's user id. */
  me: string | null;
  /** User ids of the phones connected to the room right now. */
  online: Set<string>;
  /** The live connection is up; while it is down the room is checked every few seconds instead. */
  live: boolean;
  /** Reactions on screen right now, oldest first. */
  reactions: ShownReaction[];
  /** Sends a reaction to every phone in the room (and shows it here). */
  react: (emoji: ReactionEmoji) => void;
  /** Reload now (after an error, or to be sure). */
  refresh: () => void;
}

export function useRoom(roomId: string): RoomView {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<OnlineError | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [live, setLive] = useState(false);
  const [reactions, setReactions] = useState<ShownReaction[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<string | null>(null);
  const membersRef = useRef<string[]>([]);
  membersRef.current = snapshot?.members.map((m) => m.user_id) ?? [];
  const nextReaction = useRef(0);

  const show = useCallback((reaction: Reaction) => {
    const id = ++nextReaction.current;
    setReactions((list) => [...list.slice(-7), { ...reaction, id }]);
    window.setTimeout(() => setReactions((list) => list.filter((r) => r.id !== id)), REACTION_MS);
  }, []);

  const react = useCallback(
    (emoji: ReactionEmoji) => {
      const from = meRef.current;
      if (!from) return;
      show({ emoji, from });
      void channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji, from } });
    },
    [show],
  );
  // Ignore answers that arrive after a newer one (or after leaving the screen).
  const latest = useRef(0);

  const refresh = useCallback(() => {
    const ticket = ++latest.current;
    fetchRoom(roomId).then(
      (s) => {
        if (ticket !== latest.current) return;
        setSnapshot(s);
        setError(null);
        setLoading(false);
      },
      (e) => {
        if (ticket !== latest.current) return;
        setError(toOnlineError(e));
        setLoading(false);
      },
    );
  }, [roomId]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let live = false;
    refresh();
    // Until the live connection is up (or whenever it drops), check the room every few seconds.
    const poll = setInterval(() => !live && refresh(), POLL_MS);
    signIn().then(
      ({ supabase, userId }) => {
        if (cancelled) return;
        setMe(userId);
        meRef.current = userId;
        channel = supabase
          .channel(`room:${roomId}`, { config: { presence: { key: userId } } })
          .on("postgres_changes", { event: "*", schema: "online", table: "rooms", filter: `id=eq.${roomId}` }, refresh)
          .on("broadcast", { event: "reaction" }, ({ payload }) => {
            const reaction = parseReaction(payload, membersRef.current);
            if (reaction) show(reaction);
          })
          .on("presence", { event: "sync" }, () => {
            if (channel) setOnline(new Set(Object.keys(channel.presenceState())));
          })
          .subscribe((status) => {
            live = status === "SUBSCRIBED";
            setLive(live);
            if (live) {
              channel?.track({ at: Date.now() });
              // Catch anything that changed while connecting.
              refresh();
            }
          });
        channelRef.current = channel;
      },
      (e) => !cancelled && setError(toOnlineError(e)),
    );

    // Coming back to the app (screen unlocked, tab focused): make sure we are up to date.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      latest.current++;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      channelRef.current = null;
      if (channel) void channel.unsubscribe();
    };
  }, [roomId, refresh, show]);

  return { snapshot, loading, error, me, online, live, reactions, react, refresh };
}
