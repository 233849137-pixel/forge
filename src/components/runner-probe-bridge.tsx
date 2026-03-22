"use client";

import { useEffect } from "react";

const PROBE_INTERVAL_MS = 60_000;

export default function RunnerProbeBridge() {
  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    let disposed = false;

    async function probe() {
      try {
        await fetch("/api/forge/runners/probe", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({})
        });
      } catch {
        if (disposed) {
          return;
        }
      }
    }

    probe();
    const timer = window.setInterval(probe, PROBE_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
