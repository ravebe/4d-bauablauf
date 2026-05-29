import { useState, useEffect } from "react";
import type { Modell } from "../types";

interface Props {
  api: any;
  aktivesModellId: string;
  setAktivesModellId: (id: string) => void;
}

export default function ModelSelector({ api, aktivesModellId, setAktivesModellId }: Props) {
  const [modelle, setModelle] = useState<Modell[]>([]);
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState("");

  async function modelleAbrufen() {
    if (!api) { setFehler("Keine Verbindung."); return; }
    setLaden(true);
    setFehler("");
    try {
      const result = await api.viewer.getModels();
      const rohe = Array.isArray(result) ? result : [];
      const liste: Modell[] = rohe.map((m: any) => ({
        id: m.modelId || m.id || String(m),
        name: m.name || m.fileName || "Unbekanntes Modell",
      }));
      setModelle(liste);
      // Automatisch erstes Modell wählen
      if (liste.length > 0 && !aktivesModellId) {
        setAktivesModellId(liste[0].id);
      }
      // Wenn aktuelles Modell nicht mehr in Liste → erstes wählen
      if (liste.length > 0 && !liste.find(m => m.id === aktivesModellId)) {
        setAktivesModellId(liste[0].id);
      }
    } catch (err) {
      console.error("Modelle:", err);
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
      <div className="section-header">
        <span>IFC-Modelle</span>
        <button className="btn-xs" onClick={modelleAbrufen} disabled={laden}>
          {laden ? "⟳" : "⟳ Aktualisieren"}
        </button>
      </div>

      <div className="info-box">
        Modelle werden automatisch erkannt. Das aktive Modell (blau) wird für alle Operationen verwendet.
      </div>

      {fehler && <div className="alert error">{fehler}</div>}

      {modelle.length === 0 && !laden && (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>🏗️</div>
          <p>Keine Modelle gefunden.</p>
          <p style={{ fontSize: 10, color: "#555" }}>Lade zuerst ein IFC-Modell im 3D Viewer.</p>
        </div>
      )}

      {modelle.map((m) => (
        <div
          key={m.id}
          className={`modell-item ${aktivesModellId === m.id ? "aktiv" : ""}`}
          onClick={() => setAktivesModellId(m.id)}
        >
          <div className="modell-icon">🏗️</div>
          <div className="modell-info">
            <div className="modell-name">{m.name}</div>
            <div className="modell-id">{m.id.slice(0, 20)}...</div>
          </div>
          {aktivesModellId === m.id && (
            <span className="aktiv-badge">● Aktiv</span>
          )}
        </div>
      ))}
    </div>
  );
}