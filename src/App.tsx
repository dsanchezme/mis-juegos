import { useEffect, useState } from "react";
import { CATALOG } from "./games/catalog";
import { Hub } from "./hub/Hub";
import { unlockAudio } from "./ui/effects";

const gameFromHash = () => {
  const id = location.hash.replace(/^#\/?/, "");
  return CATALOG.some((j) => j.id === id) ? id : null;
};

export function App() {
  const [game, setGame] = useState<string | null>(gameFromHash);

  useEffect(() => {
    const handleChange = () => setGame(gameFromHash());
    window.addEventListener("hashchange", handleChange);
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("hashchange", handleChange);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  const open = (id: string) => {
    location.hash = id;
  };
  const exit = () => {
    history.replaceState(null, "", location.pathname + location.search);
    setGame(null);
  };

  const entry = CATALOG.find((j) => j.id === game);
  if (entry) return <entry.Component exit={exit} />;
  return <Hub open={open} />;
}
