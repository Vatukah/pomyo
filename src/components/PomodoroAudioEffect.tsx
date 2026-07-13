import { useBootStore } from "../store/boot.store.ts";
import { useEffect } from "react";
import gearSound from "../assets/gear3.mp3";
import bellSound from "../assets/bell.mp3";
import clockTickSound from "../assets/clock-tick.mp3";
import cuteSound from "../assets/cute.mp3";
import softSound from "../assets/soft.mp3";
import sfxs from "../uitls/sfx.json";
import { pomyoSound } from "../core/controllers.ts";
import { usePomyoAudioStore } from "../core/controllers.ts";

import { usePomyoStore } from "../core/timer.ts";
import type { TimerEventMap } from "../timer/timer.types.ts";

const defaultSounds = {
  gear: gearSound,
  bell: bellSound,
  kitchen: clockTickSound,
  cute:cuteSound,
  soft:softSound
};

export default function PomodoroAudioEffects() {
  const subscribe = usePomyoStore((s) => s.subscribeToEvent);
  const markReady = useBootStore((s) => s.markReady);
  const { playLoop, playAlarm, stopLoop } = usePomyoAudioStore();

  useEffect(() => {
    let cancelled = false;

    const unlockHandler = () => {
      pomyoSound.unlock();
    };

    async function initSounds() {
      const sounds = {
        ...sfxs.music,
        ...sfxs.alarm,
        gear: gearSound,
      };

      try {
         await pomyoSound.loadAll(sounds);
      } catch (err) {
        console.error("Failed to load sounds", err);
          await pomyoSound.loadAll(defaultSounds);
      } finally {
        if (!cancelled) {
          markReady("sounds"); // ✅ fires ONLY after all sounds loaded
        }
      }
    }

    initSounds();

    document.body.addEventListener("click", unlockHandler);

    return () => {
      cancelled = true;
      document.body.removeEventListener("click", unlockHandler);
    };
  }, [markReady, pomyoSound]);

  useEffect(() => {
    const unsub = subscribe("status", (payload: TimerEventMap["status"]) => {
      const { status } = payload;
      if (status === "ticking") {
        playLoop();
        return;
      }

      // Anything else:
      stopLoop();
    });
    const unsub_complete = subscribe("complete", () => {
      playAlarm();
    });

    return () => {
      unsub_complete();
      unsub();
    }; // cleanup to prevent leaks
  }, [subscribe]);
  return null;
}
