import { useState } from "react";
import type { TcCamera } from "../types";
import type { ApiInstance, PickInfo } from "../hooks/useApi";

interface Props {
  api: ApiInstance | null;
  aktivesModellId: string | null;
  geladeneModelle: { id: string; name: string }[];
  letzterPick: PickInfo | null;
}

// Massstab-Optionen
const MASSSTAB_OPTIONEN = [
  { label: "1:20", wert: 20 },
  { label: "1:50", wert: 50 },
  { label: "1:100", wert: 100 },
  { label: "1:200", wert: 200 },
  { label: "1:500", wert: 500 },
];

// Papierformate (nutzbare Breite/Höhe in mm, abzgl. Rand)
const PAPIER_OPTIONEN = [
  { label: "A4 quer", breiteMM: 277, hoeheMM: 190 },
  { label: "A4 hoch", breiteMM: 190, hoeheMM: 277 },
  { label: "A3 quer", breiteMM: 400, hoeheMM: 277 },
  { label: "A3 hoch", breiteMM: 277, hoeheMM: 400 },
];

export default function TabSchnitt({ api, letzterPick }: Props) {
  // Schnittfeld-Status
  const [schnittfeldAktiv, setSchnittfeldAktiv] = useState(false);

  // Kamera
  const [abstandM, setAbstandM] = useState(10);

  // Druckeinstellungen
  const [massstabIdx, setMassstabIdx] = useState(2); // 1:100
  const [papierIdx, setPapierIdx] = useState(0); // A4 quer

  // Status
  const [kameraInfo, setKameraInfo] = useState<TcCamera | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [pickDebug, setPickDebug] = useState<string | null>(null);

  // Gespeicherte Schnittfeld-Infos für Kamera-Ausrichtung
  const [schnittNormal, setSchnittNormal] = useState<{ x: number; y: number; z: number } | null>(null);
  const [schnittPos, setSchnittPos] = useState<{ x: number; y: number; z: number } | null>(null);

  const massstab = MASSSTAB_OPTIONEN[massstabIdx];
  const papier = PAPIER_OPTIONEN[papierIdx];
  const orthoSizeBerechnet = (papier.breiteMM / 1000) * massstab.wert;

  // ─── 1. Schnittfeld aus Pick-Punkt setzen ───
  async function schnittfeldAusPick() {
    if (!api || !letzterPick) return;
    setStatus(null);
    setLaedt(true);
    setPickDebug(JSON.stringify(letzterPick.raw, null, 1));

    try {
      const pos = letzterPick.position;
      if (!pos) {
        setStatus("Kein Pick-Punkt vorhanden — bitte zuerst ein Objekt im Viewer anklicken");
        return;
      }

      // Normale bestimmen: aus Pick-Event oder Fallback auf dominante Achse
      let nx = 0, ny = 0, nz = 0;
      if (letzterPick.normal) {
        nx = letzterPick.normal.x;
        ny = letzterPick.normal.y;
        nz = letzterPick.normal.z;
      } else {
        // Fallback: Grundriss (von oben) als Standard
        nz = 1;
      }

      // Dominante Achse bestimmen für achsenausgerichtete Section Box
      const absX = Math.abs(nx);
      const absY = Math.abs(ny);
      const absZ = Math.abs(nz);

      // TC Section Box erwartet wahrscheinlich Meter (wie Kamera)
      // Testen: Position aus Pick könnte mm oder m sein — wir loggen beides
      const TIEFE = 0.5; // 50cm in Metern
      const AUSDEHNUNG = 100; // 100m seitliche Ausdehnung

      let boxMin: { x: number; y: number; z: number };
      let boxMax: { x: number; y: number; z: number };

      if (absZ >= absX && absZ >= absY) {
        // Horizontale Fläche (Decke/Boden) → Box begrenzt in Z
        const dir = nz >= 0 ? 1 : -1;
        boxMin = { x: pos.x - AUSDEHNUNG, y: pos.y - AUSDEHNUNG, z: pos.z - (dir > 0 ? TIEFE : 0) };
        boxMax = { x: pos.x + AUSDEHNUNG, y: pos.y + AUSDEHNUNG, z: pos.z + (dir > 0 ? 0 : TIEFE) };
        setSchnittNormal({ x: 0, y: 0, z: dir });
      } else if (absX >= absY) {
        // Wand entlang X → Box begrenzt in X
        const dir = nx >= 0 ? 1 : -1;
        boxMin = { x: pos.x - (dir > 0 ? TIEFE : 0), y: pos.y - AUSDEHNUNG, z: pos.z - AUSDEHNUNG };
        boxMax = { x: pos.x + (dir > 0 ? 0 : TIEFE), y: pos.y + AUSDEHNUNG, z: pos.z + AUSDEHNUNG };
        setSchnittNormal({ x: dir, y: 0, z: 0 });
      } else {
        // Wand entlang Y → Box begrenzt in Y
        const dir = ny >= 0 ? 1 : -1;
        boxMin = { x: pos.x - AUSDEHNUNG, y: pos.y - (dir > 0 ? TIEFE : 0), z: pos.z - AUSDEHNUNG };
        boxMax = { x: pos.x + AUSDEHNUNG, y: pos.y + (dir > 0 ? 0 : TIEFE), z: pos.z + AUSDEHNUNG };
        setSchnittNormal({ x: 0, y: dir, z: 0 });
      }

      setSchnittPos(pos);

      // Erst bestehende Box entfernen
      try { await api.viewer.removeSectionBox(); } catch { /* ok */ }
      // Auch Schnittebenen aufräumen
      try { await api.viewer.removeSectionPlanes(); } catch { /* ok */ }

      console.log("[Skizzentool] SectionBox:", JSON.stringify({ min: boxMin, max: boxMax }));
      await api.viewer.addSectionBox({ min: boxMin, max: boxMax });
      setSchnittfeldAktiv(true);
      setStatus("✓ Schnittfeld gesetzt — im Viewer die Grösse mit den Griffen anpassen");
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  // ─── Schnittfeld entfernen ───
  async function schnittfeldEntfernen() {
    if (!api) return;
    setLaedt(true);
    try {
      await api.viewer.removeSectionBox();
      try { await api.viewer.removeSectionPlanes(); } catch { /* ok */ }
      setSchnittfeldAktiv(false);
      setSchnittNormal(null);
      setSchnittPos(null);
      setStatus("✓ Schnittfeld entfernt");
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  // ─── 2. Kamera orthographisch ausrichten ───
  async function kameraAusrichten() {
    if (!api || !schnittPos || !schnittNormal) return;
    setStatus(null);
    setLaedt(true);
    try {
      const nx = schnittNormal.x;
      const ny = schnittNormal.y;
      const nz = schnittNormal.z;

      let camPos: { x: number; y: number; z: number };
      let upDir: { x: number; y: number; z: number };

      if (Math.abs(nz) > 0.5) {
        // Grundriss: Kamera oben, schaut nach unten
        camPos = {
          x: schnittPos.x,
          y: schnittPos.y,
          z: schnittPos.z + abstandM * (nz > 0 ? 1 : -1),
        };
        upDir = { x: 0, y: 1, z: 0 };
      } else {
        // Wandschnitt: Kamera vor der Fläche
        camPos = {
          x: schnittPos.x + nx * abstandM,
          y: schnittPos.y + ny * abstandM,
          z: schnittPos.z + nz * abstandM,
        };
        upDir = { x: 0, y: 0, z: 1 };
      }

      const neueKamera: TcCamera = {
        position: camPos,
        lookAt: schnittPos,
        upDirection: upDir,
        projectionType: "orthographic",
        orthoSize: orthoSizeBerechnet,
      };

      await api.viewer.setCamera(neueKamera);
      const rueckgelesen = await api.viewer.getCamera();
      setKameraInfo(rueckgelesen);
      setStatus(`✓ Kamera ausgerichtet — ${massstab.label} / ${papier.label}`);
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  // ─── 3. Snapshot ───
  async function snapshotMachen() {
    if (!api) return;
    setLaedt(true);
    setStatus(null);
    try {
      const url = await api.viewer.getSnapshot();
      setSnapshotUrl(url);
      setStatus("✓ Snapshot erstellt");
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

        {/* 1. Schnittfeld */}
        <div className="detail-block">
          <div className="detail-block-title">1. Schnittfeld</div>
          <div className="tc-section-desc" style={{ marginBottom: 6 }}>
            Klicke auf eine Fläche im Viewer, dann «Schnittfeld setzen».
            Die Box orientiert sich an der angeklickten Fläche, 50 cm tief.
            Grösse danach im Viewer mit den Griffen anpassen.
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
                  {letzterPick.normal.x.toFixed(2)},
                  {letzterPick.normal.y.toFixed(2)},
                  {letzterPick.normal.z.toFixed(2)}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 10, color: "var(--tc-text-3)", marginBottom: 6 }}>
              ⟳ Warte auf Klick im Viewer…
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <button className="tc-btn-primary" style={{ flex: 1 }}
              disabled={laedt || !letzterPick?.position}
              onClick={schnittfeldAusPick}>
              📦 Schnittfeld setzen
            </button>
            {schnittfeldAktiv && (
              <button className="tc-btn-ghost" disabled={laedt} onClick={schnittfeldEntfernen}>
                🗑
              </button>
            )}
          </div>
        </div>

        {/* 2. Druckeinstellungen + Kamera */}
        <div className="detail-block">
          <div className="detail-block-title">2. Druckeinstellungen</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <div className="tc-section-label">Massstab</div>
              <select className="tc-input" value={massstabIdx}
                onChange={e => setMassstabIdx(Number(e.target.value))}>
                {MASSSTAB_OPTIONEN.map((m, i) => (
                  <option key={i} value={i}>{m.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div className="tc-section-label">Papierformat</div>
              <select className="tc-input" value={papierIdx}
                onChange={e => setPapierIdx(Number(e.target.value))}>
                {PAPIER_OPTIONEN.map((p, i) => (
                  <option key={i} value={i}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--tc-text-3)", marginBottom: 6 }}>
            Sichtbereich: {orthoSizeBerechnet.toFixed(1)}m × {((papier.hoeheMM / 1000) * massstab.wert).toFixed(1)}m
          </div>

          <div style={{ marginBottom: 6 }}>
            <div className="tc-section-label">Kamera-Abstand (m)</div>
            <input className="tc-input" type="number" value={abstandM}
              onChange={e => setAbstandM(Number(e.target.value))}
              style={{ width: 80 }} />
          </div>

          <button className="tc-btn-primary" style={{ width: "100%" }}
            disabled={laedt || !schnittPos || !schnittNormal} onClick={kameraAusrichten}>
            📐 Orthographisch ausrichten
          </button>

          {kameraInfo && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 10, color: "var(--tc-text-3)", cursor: "pointer" }}>
                Debug: Kamera-Rückgabe
              </summary>
              <div style={{ fontSize: 9, color: "var(--tc-text-3)", fontFamily: "monospace", whiteSpace: "pre-wrap", marginTop: 4 }}>
                {JSON.stringify(kameraInfo, null, 1)}
              </div>
            </details>
          )}
        </div>

        {/* 3. Snapshot */}
        <div className="detail-block">
          <div className="detail-block-title">3. Snapshot</div>
          <button className="tc-btn-primary" style={{ width: "100%" }} disabled={laedt} onClick={snapshotMachen}>
            📷 Snapshot erstellen
          </button>
          {snapshotUrl && (
            <img src={snapshotUrl} alt="Snapshot" style={{ width: "100%", marginTop: 8, border: "1px solid var(--tc-border)", borderRadius: 4 }} />
          )}
        </div>

        {/* Status */}
        {status && (
          <div className={`alert ${status.startsWith("✓") ? "ok" : "err"}`}>
            {status}
          </div>
        )}

        {/* Debug: Pick-Rohdaten */}
        {pickDebug && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ fontSize: 10, color: "var(--tc-text-3)", cursor: "pointer" }}>
              Debug: Pick-Rohdaten
            </summary>
            <div style={{ fontSize: 9, color: "var(--tc-text-3)", fontFamily: "monospace", whiteSpace: "pre-wrap", marginTop: 4 }}>
              {pickDebug}
            </div>
          </details>
        )}

      </div>
    </div>
  );
}
