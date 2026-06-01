import { useState, useEffect } from "react";
import type { ViewerState } from "../hooks/useApi";

interface Props {
  api: any;
  viewerState: ViewerState;
  aktivesModellId: string;
  setAktivesModellId: (id: string) => void;
}

export default function ModelSelector({ api, viewerState, aktivesModellId, setAktivesModellId }: Props) {
  const { modelle } = viewerState;
  const [laden, setLaden] = useState(false);

  async function aktualisieren() {
    if (!api) return;
    setLaden(true);
    try {
      const res = await api.viewer.getModels();
      console.log("getModels:", res);
    } catch (e) { console.error(e); }
    finally { setLaden(false); }
  }

  useEffect(() => {
    if (modelle.length > 0 && !aktivesModellId) {
      setAktivesModellId(modelle[0].id);
    }
  }, [modelle]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="hinweis">Im 3D Viewer geladene Modelle:</span>
        <button className="btn-xs" onClick={aktualisieren} disabled={laden}>
          {laden ? "⟳" : "⟳ Aktualisieren"}
        </button>
      </div>

      {modelle.length === 0 && (
        <div className="alert warn">
          ⚠ Keine Modelle gefunden. Lade zuerst ein IFC-Modell im 3D Viewer.
        </div>
      )}

      {modelle.map(m => (
        <div
          key={m.id}
          className={`modell-item ${aktivesModellId === m.id ? "aktiv" : ""}`}
          onClick={() => setAktivesModellId(m.id)}
        >
          <div className="modell-icon">🏗️</div>
          <div className="modell-info">
            <div className="modell-name">{m.name}</div>
            <div className="modell-id">{m.id.slice(0, 24)}...</div>
          </div>
          {aktivesModellId === m.id && (
            <span className="aktiv-badge">✓ Aktiv</span>
          )}
        </div>
      ))}

      {aktivesModellId && (
        <div style={{ marginTop: 8, padding: "5px 8px", background: "#DFF6DD", borderRadius: 4, fontSize: 11, color: "#0A4A0A" }}>
          ✓ Aktives Modell: {modelle.find(m => m.id === aktivesModellId)?.name || aktivesModellId.slice(0, 20)}
        </div>
      )}
    </div>
  );
}