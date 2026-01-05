import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { normalizeState } from "../game/rules";

export function useGameRoom(roomCode) {
  const [gameRow, setGameRow] = useState(null);

  useEffect(() => {
    if (!roomCode) return;

    const code = roomCode.toUpperCase();

    const channel = supabase
      .channel(`game:${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `code=eq.${code}` },
        (payload) => {
          if (payload.new) setGameRow(payload.new);
        }
      )
      .subscribe();

    (async () => {
      const { data } = await supabase.from("games").select("*").eq("code", code).single();
      if (data) setGameRow(data);
    })();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  const state = normalizeState(gameRow?.state);

  return { gameRow, setGameRow, state };
}
