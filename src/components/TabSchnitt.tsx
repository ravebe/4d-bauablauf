import { useState } from "react";
import type { TcSectionPlane, TcCamera } from "../types";
import type { ApiInstance } from "../hooks/useApi";

interface Props {
  api: ApiInstance | null;
  aktivesModellId: string | null;
  geladeneModelle: { id: string; name: string }[];
}

// Pitch/Yaw aus Ebenen-Normale berechnen.
// ANNAHME (noch nicht in echtem TC verifiziert — beim Testen mit Screenshot prüfen):
// - Normale fast vertikal (|nz| > 0.7) → horizontaler Schnitt (Grundriss) → Kamera blickt senkrecht nach unten
// - sonst → vertikaler Schnitt (Wand/Querschnitt) → Kamera blickt horizontal auf die Ebene
function berechnePitchYaw(nx: number, ny: number, nz: number): { pitch: number; yaw: number } {
  if (Math.abs(nz) > 0.7) {
    // Grundriss: von oben nach unten schauen
    return { pitch: -Math.PI / 2, yaw: 0 };
  }
  // Wandschnitt: horizontal auf die Ebene schauen (Blickrichtung = -Normale)
  const yaw = Math.atan2(-nx, -ny);
  return { pitch: 0, yaw };
}

export default function TabSchnitt({ api, aktivesModellId, geladeneModelle }: Props) {
  const modellId = geladeneModelle[0]?.id ?? aktivesModellId ?? null;

  const [ebenen, setEbenen] = useState<TcSectionPlane[]>([]);
  const [aktiveEbeneId, setAktiveEbeneId] = useState<number | null>(null);
  const [abstandM, setAbstandM] = useState(10);
  const [orthoSizeM, setOrthoSizeM] = useState(5);
  const [kameraInfo, setKameraInfo] = useState<TcCamera | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  const aktiveEbene = ebenen.find(e => e.id === aktiveEbeneId) ?? null;

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
      setStatus(`✓ ${ausrichtung === "horizontal" ? "Horizontale" : "Vertikale"} Ebene gesetzt — im Viewer mit Maus verschieben`);
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
      setEbenen([]);
      setAktiveEbeneId(null);
      setStatus("✓ Alle Schnittebenen entfernt");
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  async function kameraAusrichten() {
    if (!api || !aktiveEbene) return;
    setStatus(null);
    setLaedt(true);
    try {
      const nx = aktiveEbene.directionX ?? 0;
      const ny = aktiveEbene.directionY ?? 0;
      const nz = aktiveEbene.directionZ ?? 1;
      // SectionPlane-Position ist in MILLIMETERN, Camera-Position in METERN
      const posM = {
        x: (aktiveEbene.positionX ?? 0) / 1000,
        y: (aktiveEbene.positionY ?? 0) / 1000,
        z: (aktiveEbene.positionZ ?? 0) / 1000,
      };
      const camPos = {
        x: posM.x + nx * abstandM,
        y: posM.y + ny * abstandM,
        z: posM.z + nz * abstandM,
      };
      const { pitch, yaw } = berechnePitchYaw(nx, ny, nz);

      const neueKamera: TcCamera = {
        position: camPos,
        pitch,
        yaw,
        projectionType: "orthographic",
        orthoSize: orthoSizeM,
      };
      await api.viewer.setCamera(neueKamera);
      // Zur Kontrolle zurücklesen — TC könnte Werte anders interpretieren/korrigieren
      const rueckgelesen = await api.viewer.getCamera();
      setKameraInfo(rueckgelesen);
      setStatus("✓ Kamera ausgerichtet — siehe Debug-Info unten");
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

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
            Ebene erscheint im Viewer mit Griffen — Position/Richtung dort mit der Maus anpassen.
          </div>
        </div>

        {/* 2. Ebenen */}
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

        {/* 3. Kamera ausrichten */}
        <div className="detail-block">
          <div className="detail-block-title">3. Orthographische Kamera</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <div style={{ flex: 1 }}>
              <div className="tc-section-label">Abstand (m)</div>
              <input className="tc-input" type="number" value={abstandM}
                onChange={e => setAbstandM(Number(e.target.value))} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="tc-section-label">OrthoSize (m)</div>
              <input className="tc-input" type="number" value={orthoSizeM}
                onChange={e => setOrthoSizeM(Number(e.target.value))} />
            </div>
          </div>
          <button className="tc-btn-primary" style={{ width: "100%" }}
            disabled={laedt || !aktiveEbene} onClick={kameraAusrichten}>
            📐 Orthographisch ausrichten
          </button>

          {kameraInfo && (
            <div style={{ marginTop: 8, fontSize: 9, color: "var(--tc-text-3)", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(kameraInfo, null, 1)}
            </div>
          )}
        </div>

        {/* 4. Test-Snapshot */}
        <div className="detail-block">
          <div className="detail-block-title">4. Test-Snapshot</div>
          <button className="tc-btn-primary" style={{ width: "100%" }} disabled={laedt} onClick={snapshotMachen}>
            📷 Snapshot erstellen
          </button>
          {snapshotUrl && (
            <img src={snapshotUrl} alt="Snapshot" style={{ width: "100%", marginTop: 8, border: "1px solid var(--tc-border)", borderRadius: 4 }} />
          )}
        </div>

        {status && (
          <div className={`alert ${status.startsWith("✓") ? "ok" : "err"}`}>
            {status}
          </div>
        )}

      </div>
    </div>
  );
}
