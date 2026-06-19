import { useState } from "react";
import type { TcSectionPlane, TcCamera } from "../types";
import type { ApiInstance } from "../hooks/useApi";

interface Props {
  api: ApiInstance | null;
  aktivesModellId: string | null;
  geladeneModelle: { id: string; name: string }[];
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

export default function TabSchnitt({ api, aktivesModellId, geladeneModelle }: Props) {
  const modellId = geladeneModelle[0]?.id ?? aktivesModellId ?? null;

  // Schnittebenen
  const [ebenen, setEbenen] = useState<TcSectionPlane[]>([]);
  const [aktiveEbeneId, setAktiveEbeneId] = useState<number | null>(null);

  // Schnittbox
  const [tiefeCM, setTiefeCM] = useState(50); // Standard 50cm

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

  const aktiveEbene = ebenen.find(e => e.id === aktiveEbeneId) ?? null;
  const massstab = MASSSTAB_OPTIONEN[massstabIdx];
  const papier = PAPIER_OPTIONEN[papierIdx];

  // OrthoSize berechnen: Papierbreite (m) × Massstab = sichtbare Modellbreite in Metern
  // Beispiel: A4 quer 277mm bei 1:100 → 0.277 * 100 = 27.7m sichtbar
  const orthoSizeBerechnet = (papier.breiteMM / 1000) * massstab.wert;

  // ─── 1. Schnittebene setzen ───
  async function ebeneSetzen(ausrichtung: "horizontal" | "vertikal") {
    if (!api) return;
    setStatus(null);
    setLaedt(true);
    try {
      const neu: TcSectionPlane = ausrichtung === "horizontal"
        ? { positionX: 0, positionY: 0, positionZ: 0, directionX: 0, directionY: 0, directionZ: 1, controlsVisible: true }
        : { positionX: 0, positionY: 0, positionZ: 0, directionX: 1, directionY: 0, directionZ: 0, controlsVisible: true };
      await api.viewer.addSectionPlane(neu);
      await ebenenAktualisieren();
      setStatus(`✓ ${ausrichtung === "horizontal" ? "Horizontale" : "Vertikale"} Ebene gesetzt — im Viewer verschieben`);
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  async function ebenenAktualisieren() {
    if (!api) return;
    try {
      const res = await api.viewer.getSectionPlanes();
      const liste = Array.isArray(res) ? res : [];
      setEbenen(liste);
      if (liste.length > 0 && aktiveEbeneId == null) {
        setAktiveEbeneId(liste[0].id ?? null);
      }
    } catch (e) {
      setStatus(`Fehler beim Auslesen: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function ebenenEntfernen() {
    if (!api) return;
    setLaedt(true);
    try {
      await api.viewer.removeSectionPlanes();
      await api.viewer.removeSectionBox();
      setEbenen([]);
      setAktiveEbeneId(null);
      setStatus("✓ Alle Schnittebenen + Box entfernt");
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  // ─── 2. Schnittbox aus aktiver Ebene + Tiefe ───
  async function schnittboxSetzen() {
    if (!api || !aktiveEbene) return;
    setStatus(null);
    setLaedt(true);
    try {
      const px = aktiveEbene.positionX ?? 0;
      const py = aktiveEbene.positionY ?? 0;
      const pz = aktiveEbene.positionZ ?? 0;
      const nx = aktiveEbene.directionX ?? 0;
      const nz = aktiveEbene.directionZ ?? 1;

      // Tiefe in mm (Position der SectionPlane ist in mm)
      const tiefeMM = tiefeCM * 10;
      const halbeTiefe = tiefeMM / 2;

      // Grosse Ausdehnung in den anderen Richtungen
      const GROSS = 200000; // 200m in mm

      let boxMin: { x: number; y: number; z: number };
      let boxMax: { x: number; y: number; z: number };

      if (Math.abs(nz) > 0.7) {
        // Horizontaler Schnitt (Grundriss) — Box um Z-Achse begrenzt
        boxMin = { x: px - GROSS, y: py - GROSS, z: pz - halbeTiefe };
        boxMax = { x: px + GROSS, y: py + GROSS, z: pz + halbeTiefe };
      } else if (Math.abs(nx) > 0.7) {
        // Vertikaler Schnitt entlang X
        boxMin = { x: px - halbeTiefe, y: py - GROSS, z: pz - GROSS };
        boxMax = { x: px + halbeTiefe, y: py + GROSS, z: pz + GROSS };
      } else {
        // Vertikaler Schnitt entlang Y
        boxMin = { x: px - GROSS, y: py - halbeTiefe, z: pz - GROSS };
        boxMax = { x: px + GROSS, y: py + halbeTiefe, z: pz + GROSS };
      }

      // Erst bestehende Box entfernen
      try { await api.viewer.removeSectionBox(); } catch { /* ok */ }

      await api.viewer.addSectionBox({ min: boxMin, max: boxMax });
      setStatus(`✓ Schnittbox gesetzt (Tiefe: ${tiefeCM} cm)`);
    } catch (e) {
      setStatus(`Fehler Schnittbox: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  // ─── 3. Kamera orthographisch ausrichten ───
  // Benutzt lookAt + upDirection statt pitch/yaw (zuverlässiger in TC)
  async function kameraAusrichten() {
    if (!api || !aktiveEbene) return;
    setStatus(null);
    setLaedt(true);
    try {
      const nx = aktiveEbene.directionX ?? 0;
      const ny = aktiveEbene.directionY ?? 0;
      const nz = aktiveEbene.directionZ ?? 1;

      // SectionPlane-Position mm → Kamera-Position Meter
      const posM = {
        x: (aktiveEbene.positionX ?? 0) / 1000,
        y: (aktiveEbene.positionY ?? 0) / 1000,
        z: (aktiveEbene.positionZ ?? 0) / 1000,
      };

      let camPos: { x: number; y: number; z: number };
      let upDir: { x: number; y: number; z: number };

      if (Math.abs(nz) > 0.7) {
        // Grundriss: Kamera oben, schaut nach unten
        // Vorzeichen von nz bestimmt ob von oben oder unten
        const richtung = nz > 0 ? 1 : -1;
        camPos = {
          x: posM.x,
          y: posM.y,
          z: posM.z + abstandM * richtung,
        };
        // Up-Direction = Y-Achse (Norden oben im Grundriss)
        upDir = { x: 0, y: 1, z: 0 };
      } else {
        // Wandschnitt: Kamera vor der Ebene, schaut horizontal darauf
        camPos = {
          x: posM.x + nx * abstandM,
          y: posM.y + ny * abstandM,
          z: posM.z + nz * abstandM,
        };
        // Up-Direction = Z-Achse (Oben bleibt oben)
        upDir = { x: 0, y: 0, z: 1 };
      }

      const neueKamera: TcCamera = {
        position: camPos,
        lookAt: posM,
        upDirection: upDir,
        projectionType: "orthographic",
        orthoSize: orthoSizeBerechnet,
      };

      await api.viewer.setCamera(neueKamera);

      // Zur Kontrolle zurücklesen
      const rueckgelesen = await api.viewer.getCamera();
      setKameraInfo(rueckgelesen);
      setStatus(`✓ Kamera ausgerichtet — orthoSize: ${orthoSizeBerechnet.toFixed(1)}m (${massstab.label} / ${papier.label})`);
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  // ─── 4. Snapshot ───
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

        {!modellId && (
          <div className="alert info" style={{ marginTop: 5 }}>
            ⟳ Warte auf Modell-Verbindung…
          </div>
        )}

        {/* 1. Schnittebene setzen */}
        <div className="detail-block">
          <div className="detail-block-title">1. Schnittebene setzen</div>
          <div className="typ-btns">
            <button className="tc-btn-secondary" disabled={laedt} onClick={() => ebeneSetzen("horizontal")}>
              ⬍ Horizontal
            </button>
            <button className="tc-btn-secondary" disabled={laedt} onClick={() => ebeneSetzen("vertikal")}>
              ⬌ Vertikal
            </button>
          </div>
          <div className="tc-section-desc" style={{ marginTop: 6 }}>
            Ebene im Viewer mit Griffen verschieben, dann «Aktualisieren».
          </div>
        </div>

        {/* 2. Ebenen auslesen */}
        <div className="detail-block">
          <div className="detail-block-title">2. Ebenen</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="tc-btn-primary" disabled={laedt} onClick={ebenenAktualisieren} style={{ flex: 1 }}>
              🔄 Aktualisieren
            </button>
            <button className="tc-btn-ghost" disabled={laedt || ebenen.length === 0} onClick={ebenenEntfernen}>
              🗑 Alle entfernen
            </button>
          </div>

          {ebenen.length === 0 ? (
            <div style={{ fontSize: 10, color: "var(--tc-text-3)", marginTop: 6 }}>
              Keine Schnittebenen aktiv
            </div>
          ) : (
            <div style={{ marginTop: 6 }}>
              {ebenen.map((e, i) => (
                <div
                  key={e.id ?? i}
                  onClick={() => setAktiveEbeneId(e.id ?? null)}
                  style={{
                    padding: "6px 8px",
                    fontSize: 10,
                    borderRadius: 4,
                    cursor: "pointer",
                    marginBottom: 4,
                    background: e.id === aktiveEbeneId ? "var(--tc-blue-light)" : "var(--tc-bg)",
                    border: e.id === aktiveEbeneId ? "1px solid var(--tc-blue-border)" : "1px solid var(--tc-border-light)",
                  }}
                >
                  <div><strong>Ebene #{e.id}</strong></div>
                  <div style={{ color: "var(--tc-text-3)" }}>
                    Pos (mm): {e.positionX?.toFixed(0)}, {e.positionY?.toFixed(0)}, {e.positionZ?.toFixed(0)}
                  </div>
                  <div style={{ color: "var(--tc-text-3)" }}>
                    Richtung: {e.directionX?.toFixed(2)}, {e.directionY?.toFixed(2)}, {e.directionZ?.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Schnittbox */}
        <div className="detail-block">
          <div className="detail-block-title">3. Schnittbox</div>
          <div style={{ marginBottom: 6 }}>
            <div className="tc-section-label">Tiefe (cm)</div>
            <input className="tc-input" type="number" value={tiefeCM}
              onChange={e => setTiefeCM(Number(e.target.value))}
              style={{ width: 80 }} />
          </div>
          <button className="tc-btn-primary" style={{ width: "100%" }}
            disabled={laedt || !aktiveEbene} onClick={schnittboxSetzen}>
            📦 Schnittbox setzen
          </button>
          <div className="tc-section-desc" style={{ marginTop: 4 }}>
            Begrenzt die Sichtbarkeit auf {tiefeCM} cm Tiefe um die aktive Ebene.
          </div>
        </div>

        {/* 4. Druckeinstellungen + Kamera */}
        <div className="detail-block">
          <div className="detail-block-title">4. Druckeinstellungen</div>
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
            disabled={laedt || !aktiveEbene} onClick={kameraAusrichten}>
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

        {/* 5. Snapshot */}
        <div className="detail-block">
          <div className="detail-block-title">5. Snapshot</div>
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

      </div>
    </div>
  );
}