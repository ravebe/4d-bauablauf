import { useState, useEffect } from "react";

interface Modell {
  id: string;
  name: string;
  fileName?: string;
}

interface Props {
  api: any;
  ausgewaehlteIds: string[];
  setAusgewaehlteIds: (ids: string[]) => void;
}

export default function FileBrowser({ api, ausgewaehlteIds, setAusgewaehlteIds }: Props) {
  const [modelle, setModelle] = useState<Modell[]>([]);
  const [laden, setLaden] = useState(false);
  const [manuelleId, setManuelleId] = useState("");

  async function ladeModelle() {
    if (!api) return;
    setLaden(true);
    try {
      const res = await api.viewer.getModels();
      const arr = Array.isArray(res) ? res : [];
      const liste: Modell[] = arr.map((m: any) => ({
        id: m.modelId || m.id || "",
        name: m.name || m.fileName || "Modell",
        fileName: m.fileName,
      })).filter((m: Modell) => m.id);
      setModelle(liste);
    } catch (e) {
      console.warn("getModels:", e);
    } finally {
      setLaden(false);
    }
  }

  useEffect(() => { ladeModelle(); }, [api]);

  function toggle(id: string) {
    setAusgewaehlteIds(
      ausgewaehlteIds.includes(id)
        ? ausgewaehlteIds.filter(x => x !== id)
        : [...ausgewaehlteIds, id]
    );
  }

  function manuelleHinzufuegen() {
    const id = manuelleId.trim();
    if (!id || ausgewaehlteIds.includes(id)) return;
    setAusgewaehlteIds([...ausgewaehlteIds, id]);
    setManuelleId("");
  }

  return (
    <div>
      <div className="tc-info-banner" style={{ marginBottom: 12 }}>
        💡 Öffne zuerst den 3D Viewer und lade deine IFC-Modelle. Dann erscheinen sie hier automatisch.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "var(--tc-text-2)" }}>Im 3D Viewer geladene Modelle:</span>
        <button className="tc-btn-ghost" style={{ padding: "3px 10px", fontSize: 11 }}
          onClick={ladeModelle} disabled={laden}>
          {laden ? "⟳" : "⟳ Aktualisieren"}
        </button>
      </div>

      {modelle.length === 0 && !laden && (
        <div style={{ textAlign: "center", padding: "16px 10px", border: "1px solid var(--tc-border)", borderRadius: 6, background: "var(--tc-white)", marginBottom: 10 }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🏗️</div>
          <div style={{ fontSize: 12, color: "var(--tc-text-2)", fontWeight: 500 }}>Keine Modelle im Viewer</div>
          <div style={{ fontSize: 11, color: "var(--tc-text-3)", marginTop: 3 }}>
            Öffne den 3D Viewer → lade ein IFC-Modell → komm zurück
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        {modelle.map(m => (
          <div
            key={m.id}
            className={`fb-item fb-ifc ${ausgewaehlteIds.includes(m.id) ? "selected" : ""}`}
            onClick={() => toggle(m.id)}
            style={{ marginBottom: 2 }}
          >
            <input
              type="checkbox"
              className="fb-checkbox"
              checked={ausgewaehlteIds.includes(m.id)}
              onChange={() => toggle(m.id)}
              onClick={e => e.stopPropagation()}
            />
            <span className="fb-icon">🏗️</span>
            <div className="fb-info">
              <div className="fb-name">{m.name}</div>
              <div className="fb-date" style={{ fontFamily: "monospace" }}>{m.id.slice(0, 20)}...</div>
            </div>
            <span className="fb-badge ifc">IFC</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--tc-border)", paddingTop: 10, marginTop: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--tc-text-3)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>
          Modell-ID manuell eingeben
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            style={{ flex: 1, padding: "6px 8px", border: "1px solid #BDBDBD", borderRadius: 4, fontSize: 12, fontFamily: "monospace" }}
            placeholder="Modell-ID oder Name..."
            value={manuelleId}
            onChange={e => setManuelleId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && manuelleHinzufuegen()}
          />
          <button className="tc-btn-primary" style={{ padding: "6px 12px" }}
            onClick={manuelleHinzufuegen} disabled={!manuelleId.trim()}>
            + Hinzufügen
          </button>
        </div>
      </div>

      {ausgewaehlteIds.length > 0 && (
        <div className="fb-selected-info" style={{ marginTop: 8, borderRadius: 4 }}>
          ✓ {ausgewaehlteIds.length} Modell(e) gewählt
        </div>
      )}
    </div>
  );
}