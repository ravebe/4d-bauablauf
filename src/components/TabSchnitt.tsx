import { useState } from "react";
import type { TcSectionBox } from "../types";
import type { ApiInstance, PickInfo } from "../hooks/useApi";

interface Props {
  api: ApiInstance | null;
  aktivesModellId: string | null;
  letzterPick: PickInfo | null;
  aktuelleBox: TcSectionBox | null;
}

export default function TabSchnitt({ api, letzterPick, aktuelleBox }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [blickrichtung, setBlickrichtung] = useState<{ x: number; y: number; z: number } | null>(null);

  // ─── 1. TC Schnittfeld-Tool aktivieren ───
  async function schnittfeldAktivieren() {
    if (!api) return;
    setLaedt(true);
    setStatus(null);
    try {
      await api.viewer.activateTool("sectionBox");
      setStatus("✓ Schnittfeld-Tool aktiv — im Viewer platzieren und mit Griffen anpassen");
    } catch (e) {
      // Falls "sectionBox" nicht der richtige Name ist, Alternativen probieren
      console.log("[Skizzentool] sectionBox fehlgeschlagen, versuche clipBox...");
      try {
        await api.viewer.activateTool("clipBox");
        setStatus("✓ Schnittfeld-Tool aktiv (clipBox)");
      } catch (e2) {
        console.log("[Skizzentool] clipBox auch fehlgeschlagen, versuche sectionfield...");
        try {
          await api.viewer.activateTool("sectionfield");
          setStatus("✓ Schnittfeld-Tool aktiv (sectionfield)");
        } catch (e3) {
          setStatus(`Fehler: Tool konnte nicht aktiviert werden. Versuche es manuell über die TC-Toolbar.`);
          console.error("[Skizzentool] activateTool Fehler:", e, e2, e3);
        }
      }
    } finally {
      setLaedt(false);
    }
  }

  // ─── 2. Blickrichtung aus Pick speichern ───
  function blickrichtungSpeichern() {
    if (!letzterPick?.normal) {
      setStatus("Kein Pick mit Normale vorhanden — klicke auf eine Fläche im Viewer");
      return;
    }
    setBlickrichtung(letzterPick.normal);
    setStatus("✓ Blickrichtung gespeichert");
  }

  // ─── 3. Schnittfeld entfernen ───
  async function schnittfeldEntfernen() {
    if (!api) return;
    setLaedt(true);
    try {
      await api.viewer.removeSectionBox();
      try { await api.viewer.removeSectionPlanes(); } catch { /* ok */ }
      setStatus("✓ Schnittfeld entfernt");
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  // ─── Render ───
  if (!api) {
    return (
      <div className="tc-empty">
        <div className="tc-empty-icon">⟳</div>
        <div className="tc-empty-title">Verbinde mit Trimble Connect…</div>
      </div>
    );
  }

  return (
    <div className="tasklist-wrap">
      <div className="detail-section">

        {/* 1. Schnittfeld aktivieren */}
        <div className="detail-block">
          <div className="detail-block-title">1. Schnittfeld</div>
          <div className="tc-section-desc" style={{ marginBottom: 6 }}>
            Aktiviert das TC-Schnittfeld. Platzierung, Grösse und Tiefe
            im Viewer mit den Griffen anpassen.
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="tc-btn-primary" style={{ flex: 1 }}
              disabled={laedt} onClick={schnittfeldAktivieren}>
              📦 Schnittfeld aktivieren
            </button>
            <button className="tc-btn-ghost" disabled={laedt} onClick={schnittfeldEntfernen}>
              🗑
            </button>
          </div>

          {/* Aktuelle Box-Info */}
          {aktuelleBox && (
            <div style={{
              marginTop: 6, padding: "6px 8px", fontSize: 10, borderRadius: 4,
              background: "var(--tc-bg)", border: "1px solid var(--tc-border-light)"
            }}>
              <strong>Aktives Schnittfeld:</strong>
              <div style={{ color: "var(--tc-text-3)" }}>
                Pos: {(aktuelleBox.positionX / 1000).toFixed(1)}m,
                {(aktuelleBox.positionY / 1000).toFixed(1)}m,
                {(aktuelleBox.positionZ / 1000).toFixed(1)}m
              </div>
              <div style={{ color: "var(--tc-text-3)" }}>
                Grösse: {(aktuelleBox.sizeX / 1000).toFixed(1)}m ×
                {(aktuelleBox.sizeY / 1000).toFixed(1)}m ×
                {(aktuelleBox.sizeZ / 1000).toFixed(1)}m
              </div>
            </div>
          )}
        </div>

        {/* 2. Blickrichtung */}
        <div className="detail-block">
          <div className="detail-block-title">2. Blickrichtung</div>
          <div className="tc-section-desc" style={{ marginBottom: 6 }}>
            Klicke auf die Fläche die du frontal sehen willst, dann speichere die Blickrichtung.
          </div>

          {letzterPick?.position ? (
            <div style={{
              padding: "6px 8px", fontSize: 10, borderRadius: 4, marginBottom: 6,
              background: "var(--tc-blue-light)", border: "1px solid var(--tc-blue-border)"
            }}>
              <strong>Letzter Klick:</strong>{" "}
              x={letzterPick.position.x.toFixed(2)},
              y={letzterPick.position.y.toFixed(2)},
              z={letzterPick.position.z.toFixed(2)}
              {letzterPick.normal && (
                <div>
                  <strong>Normale:</strong>{" "}
                  {letzterPick.normal.x.toFixed(3)},
                  {letzterPick.normal.y.toFixed(3)},
                  {letzterPick.normal.z.toFixed(3)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 10, color: "var(--tc-text-3)", marginBottom: 6 }}>
              ⟳ Warte auf Klick im Viewer…
            </div>
          )}

          <button className="tc-btn-secondary" style={{ width: "100%" }}
            disabled={!letzterPick?.normal} onClick={blickrichtungSpeichern}>
            🎯 Blickrichtung speichern
          </button>

          {blickrichtung && (
            <div style={{
              marginTop: 6, padding: "6px 8px", fontSize: 10, borderRadius: 4,
              background: "#e8f5e9", border: "1px solid #a5d6a7"
            }}>
              ✓ Gespeichert: ({blickrichtung.x.toFixed(3)}, {blickrichtung.y.toFixed(3)}, {blickrichtung.z.toFixed(3)})
              <div style={{ color: "var(--tc-text-3)" }}>
                {Math.abs(blickrichtung.z) > 0.7 ? "→ Grundriss (von oben)" : "→ Schnitt (frontal)"}
              </div>
            </div>
          )}
        </div>

        {/* 3. Drucken (Phase 2 Platzhalter) */}
        <div className="detail-block">
          <div className="detail-block-title">3. Drucken</div>
          <button className="tc-btn-primary" style={{ width: "100%" }}
            disabled={!blickrichtung}
            onClick={() => setStatus("Druckfenster kommt in Phase 2")}>
            🖨 Drucken…
          </button>
          <div className="tc-section-desc" style={{ marginTop: 4 }}>
            Öffnet das Druckfenster mit Massstab, Format und PDF-Export.
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className={`alert ${status.startsWith("✓") ? "ok" : "err"}`}>
            {status}
          </div>
        )}

      </div>
    </div>
  );
}
