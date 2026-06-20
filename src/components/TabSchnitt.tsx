import { useState } from "react";
import type { TcSectionBox } from "../types";
import type { ApiInstance, PickInfo } from "../hooks/useApi";
import DruckDialog from "./DruckDialog";

interface Props {
  api: ApiInstance | null;
  aktivesModellId: string | null;
  letzterPick: PickInfo | null;
  aktuelleBox: TcSectionBox | null;
  boxAktiv: boolean;
}

export default function TabSchnitt({ api, letzterPick, aktuelleBox, boxAktiv }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [blickrichtung, setBlickrichtung] = useState<{ x: number; y: number; z: number } | null>(null);
  const [blickPos, setBlickPos] = useState<{ x: number; y: number; z: number } | null>(null);
  const [druckDialogOffen, setDruckDialogOffen] = useState(false);

  // ─── 1. TC Schnittfeld-Tool aktivieren ───
  async function schnittfeldAktivieren() {
    if (!api) return;
    setLaedt(true);
    setStatus(null);
    try {
      await api.viewer.activateTool("sectionBox");
      setStatus("✓ Schnittfeld-Tool aktiv — Fläche anklicken zum Platzieren");
    } catch {
      try {
        await api.viewer.activateTool("clipBox");
        setStatus("✓ Schnittfeld-Tool aktiv");
      } catch {
        setStatus("Tool konnte nicht aktiviert werden — verwende die TC-Toolbar");
      }
    } finally {
      setLaedt(false);
    }
  }

  // ─── 2. Blickrichtung speichern ───
  function blickrichtungSpeichern() {
    if (!letzterPick?.normal || !letzterPick?.position) {
      setStatus("Klicke zuerst auf eine Fläche im Viewer");
      return;
    }
    setBlickrichtung(letzterPick.normal);
    setBlickPos(letzterPick.position);
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

  // Druckdialog
  if (druckDialogOffen && blickrichtung && blickPos) {
    return (
      <DruckDialog
        api={api}
        blickrichtung={blickrichtung}
        schnittPos={blickPos}
        onClose={() => setDruckDialogOffen(false)}
      />
    );
  }

  return (
    <div className="tasklist-wrap">
      <div className="detail-section">

        {/* 1. Schnittfeld */}
        <div className="detail-block">
          <div className="detail-block-title">1. Schnittfeld</div>
          <div className="tc-section-desc" style={{ marginBottom: 6 }}>
            TC-Schnittfeld aktivieren, dann auf eine Fläche klicken. Grösse und Tiefe mit den Griffen anpassen.
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="tc-btn-primary" style={{ flex: 1 }}
              disabled={laedt} onClick={schnittfeldAktivieren}>
              📦 Schnittfeld aktivieren
            </button>
            {boxAktiv && (
              <button className="tc-btn-ghost" disabled={laedt} onClick={schnittfeldEntfernen}>
                🗑
              </button>
            )}
          </div>

          {aktuelleBox && (
            <div style={{
              marginTop: 6, padding: "6px 8px", fontSize: 10, borderRadius: 4,
              background: "var(--tc-bg)", border: "1px solid var(--tc-border-light)"
            }}>
              <strong>Schnittfeld aktiv</strong>
              <div style={{ color: "var(--tc-text-3)" }}>
                Grösse: {(aktuelleBox.sizeX / 1000).toFixed(1)}m ×{" "}
                {(aktuelleBox.sizeY / 1000).toFixed(1)}m ×{" "}
                {(aktuelleBox.sizeZ / 1000).toFixed(1)}m
              </div>
            </div>
          )}
        </div>

        {/* 2. Blickrichtung */}
        <div className="detail-block">
          <div className="detail-block-title">2. Blickrichtung</div>
          <div className="tc-section-desc" style={{ marginBottom: 6 }}>
            Klicke auf die Fläche die du frontal sehen willst.
          </div>

          {letzterPick?.position ? (
            <div style={{
              padding: "6px 8px", fontSize: 10, borderRadius: 4, marginBottom: 6,
              background: "var(--tc-blue-light)", border: "1px solid var(--tc-blue-border)"
            }}>
              <strong>Letzter Klick</strong>
              {letzterPick.normal && (
                <div style={{ color: "var(--tc-text-3)" }}>
                  Normale: ({letzterPick.normal.x.toFixed(2)}, {letzterPick.normal.y.toFixed(2)}, {letzterPick.normal.z.toFixed(2)})
                  {" → "}
                  {Math.abs(letzterPick.normal.z) > 0.7 ? "Grundriss" : "Schnitt"}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 10, color: "var(--tc-text-3)", marginBottom: 6 }}>
              ⟳ Warte auf Klick…
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
              ✓ {Math.abs(blickrichtung.z) > 0.7 ? "Grundriss (von oben)" : "Schnitt (frontal)"}
            </div>
          )}
        </div>

        {/* 3. Drucken */}
        <div className="detail-block">
          <div className="detail-block-title">3. Drucken</div>
          <button className="tc-btn-primary" style={{ width: "100%" }}
            disabled={!blickrichtung || !blickPos}
            onClick={() => setDruckDialogOffen(true)}>
            🖨 Drucken…
          </button>
          <div className="tc-section-desc" style={{ marginTop: 4 }}>
            Öffnet die Druckvorschau mit Massstab, Format und PDF-Export.
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
