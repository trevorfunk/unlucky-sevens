// src/hooks/useGameRoom.js
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { normalizeState } from "../game/rules";

export function useGameRoom({ roomCode, setRoomCode }) {
  // ✅ Always normalize to a safe string
  const code = useMemo(() => {
    if (typeof roomCode !== "string") return "";
    return roomCode.trim().toUpperCase();
  }, [roomCode]);

  const [gameRow, setGameRow] = useState(null);
  const [state, setState] = useState({});
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  function clearError() {
    setErrorMsg("");
  }

  // Local-only patch helper (does NOT write to Supabase)
  function setStateLocal(updater) {
    setState((prev) => {
      const base = normalizeState(prev);
      const next = typeof updater === "function" ? updater(base) : updater;
      return normalizeState(next);
    });
  }

  // When code changes: fetch the row + subscribe
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErrorMsg("");
      setStatusMsg("");

      if (!code) {
        setGameRow(null);
        setState({});
        return;
      }

      const { data, error } = await supabase.from("games").select("*").eq("code", code).single();
      if (cancelled) return;

      if (error || !data) {
        setGameRow(null);
        setState({});
        setErrorMsg("Room not found (check the code).");
        return;
      }

      setGameRow(data);
      setState(normalizeState(data.state));
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [code]);

  // Realtime subscription for this room
  useEffect(() => {
    if (!code) return;

    const channel = supabase
      .channel(`games:code:${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `code=eq.${code}` },
        (payload) => {
          const row = payload?.new;
          if (!row) return;
          setGameRow(row);
          setState(normalizeState(row.state));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  return {
    // room + row/state
    code,
    gameRow,
    setGameRow,
    state,
    setStateLocal,

    // messages
    statusMsg,
    setStatusMsg,
    errorMsg,
    setErrorMsg,
    clearError,
  };
}
