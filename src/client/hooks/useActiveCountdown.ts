import { useEffect, useState } from "react";
import { formatRemainingSeconds } from "../lib/matchPresentation";

export const useActiveCountdown = (remainingSeconds: number): string => {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.round(remainingSeconds))
  );

  useEffect(() => {
    setSecondsLeft(Math.max(0, Math.round(remainingSeconds)));
  }, [remainingSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const tick = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(tick);
  }, [secondsLeft]);

  return formatRemainingSeconds(secondsLeft);
};
