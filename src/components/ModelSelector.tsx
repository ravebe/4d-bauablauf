import { useState, useEffect } from "react";
import type { Modell } from "../types";

interface Props {
  api: any;
}

export default function ModelSelector({ api }: Props) {
  const [modelle, setModelle] = useState<Modell[]>([]);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState("");

  async function modelleAbrufen() {
    if (!api) {
      setFehler("Keine Verbindung zu Trimble Connect.");
      return;
    }
    setLaden(true);
    setFehler("");
    try {
      const result = await api.viewer.getModels();
      const liste: Modell[] = result.map((m: any) => ({
        id: m.modelId || m.id,
        name: m.name || "Unbekanntes Modell",
      }));
      setModelle(liste);
    } catch (err) {
      setFehler("Modelle konnten nicht geladen werden.");
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => {
    if (api) modelleAbrufen();
  }, [api]);

  return (
    <div className="panel">
      <h2>IFC-Modelle</h2>
      <p className="hinweis">
        Stelle sicher dass deine IFC-Modelle im Trimble Connect 3D Viewer geöffnet sind.
      </p>
      <button onClick={modelleAbrufen} disabled={laden}>
        {laden ? "Lade..." : "Modelle aktualisieren"}
      </button>
      {fehler && <p className="fehler">{fehler}</p>}
      {modelle.length > 0 && (
        <div className="task-liste">
          <p className="erfolg">✓ {modelle.length} Modelle gefunden</p>
          {modelle.map((m) => (
            <div key={m.id} className="task-item">
              <span className="task-name">{m.name}</span>
              <span className="task-datum">ID: {m.id}</span>
            </div>
          ))}
        </div>
      )}
      {modelle.length === 0 && !laden && !fehler && (
        <p className="hinweis">Noch keine Modelle geladen.</p>
      )}
    </div>
  );
}