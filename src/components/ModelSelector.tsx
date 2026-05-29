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
    if (!api) { setFehler("Keine Verbindung zu Trimble Connect."); return; }
    setLaden(true);
    setFehler("");
    try {
      const result = await api.viewer.getModels();
      const liste: Modell[] = result.map((m: any) => ({
        id: m.modelId || m.id,
        name: m.name || "Unbekanntes Modell",
      }));
      setModelle(liste);
      if (liste.length > 0 && !aktivesModellId) {
        setAktivesModellId(liste[0].id);
      }
    } catch {
      setFehler("Modelle konnten nicht geladen werden.");
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => { if (api) modelleAbrufen(); }, [api]);

  return (
    <div className="panel">
      <div className="section-header">
        <span>IFC-Modelle</span>
        <button className="btn-small" onClick={modelleAbrufen} disabled={laden}>
          {laden ? "⟳ Lade..." : "⟳ Aktualisieren"}
        </button>
      </div>

      <div className="info-box">
        Stelle sicher dass deine IFC-Modelle im 3D Viewer geöffnet sind.
        Das aktive Modell wird für alle Operationen verwendet.
      </div>

      {fehler && <div className="alert error">{fehler}</div>}

      {modelle.length === 0 && !laden && (
        <div style={{ textAlign: "center", padding: "20px", color: "#555" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏗️</div>
          <p style={{ fontSize: 11 }}>Keine Modelle gefunden.<br />Lade zuerst ein IFC-Modell.</p>
        </div>
      )}

      {modelle.map((m) => (
        <div
          key={m.id}
          className={`modell-item ${aktivesModellId === m.id ? "aktiv" : ""}`}
          onClick={() => setAktivesModellId(m.id)}
        >
          <span className="modell-icon">🏗️</span>
          <div style={{ flex: 1 }}>
            <div className="modell-name">{m.name}</div>
            <div className="modell-id">{m.id.slice(0, 24)}...</div>
          </div>
          {aktivesModellId === m.id && (
            <span style={{ color: "#4da6ff", fontSize: 11 }}>● Aktiv</span>
          )}
        </div>
      ))}
    </div>
  );
}