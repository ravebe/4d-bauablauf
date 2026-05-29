import type { ViewerState } from "../hooks/useApi";

interface Props {
  api: any;
  viewerState: ViewerState;
  setAktivesModellId: (id: string) => void;
}

export default function ModelSelector({ api, viewerState, setAktivesModellId }: Props) {
  const { modelle, aktivesModellId } = viewerState;

  async function aktualisieren() {
    if (!api) return;
    try {
      const result = await api.viewer.getModels();
      console.log("Modelle raw:", result);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="panel">
      <div className="section-header">
        <span>IFC-Modelle</span>
        <button className="btn-xs" onClick={aktualisieren}>⟳ Debug</button>
      </div>

      <div className="info-box">
        Modelle werden automatisch erkannt. Aktives Modell (blau) wird für alle Operationen genutzt.
      </div>

      {modelle.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 28 }}>🏗️</div>
          <p>Keine Modelle erkannt.</p>
          <p style={{ fontSize: 10, color: "#555" }}>Lade ein IFC-Modell im 3D Viewer.</p>
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
            <div className="modell-id">{m.id.slice(0, 22)}...</div>
          </div>
          {aktivesModellId === m.id && <span className="aktiv-badge">● Aktiv</span>}
        </div>
      ))}

      {aktivesModellId && (
        <div style={{ marginTop: 8, padding: "6px 8px", background: "#1a2a3a", borderRadius: 6, fontSize: 10, color: "#64a8ff" }}>
          Aktive ID: {aktivesModellId.slice(0, 30)}...
        </div>
      )}
    </div>
  );
}