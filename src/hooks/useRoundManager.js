// src/hooks/useRoundManager.js
import { useCallback } from "react";

/**
 * Small coordinator around useGameActions.
 * The UI calls these handlers; we just route to the correct action and add light guards.
 */
export function useRoundManager({ roomCode, myId, state, setStateLocal, actions }) {
  const roundStatus = state?.roundStatus ?? "lobby";

  const beginRound = useCallback(async () => {
    if (!actions?.beginRound) {
      console.warn("beginRound: actions.beginRound is missing");
      return;
    }
    // beginRound() inside useGameActions already validates dealer, ready, players, etc.
    await actions.beginRound();
  }, [actions]);

  const preplayResolveMySevens = useCallback(async () => {
    if (!actions?.preplayResolveMySevens) {
      console.warn("preplayResolveMySevens: actions.preplayResolveMySevens is missing");
      return;
    }
    // only valid in preplay; action will no-op if not
    await actions.preplayResolveMySevens();
  }, [actions]);

  const continueToNextRound = useCallback(async () => {
    if (!actions?.continueToNextRound) {
      console.warn("continueToNextRound: actions.continueToNextRound is missing");
      return;
    }
    await actions.continueToNextRound();
  }, [actions]);

  return {
    beginRound,
    preplayResolveMySevens,
    continueToNextRound,
    roundStatus,
  };
}
