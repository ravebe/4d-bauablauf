import { useState, useRef, useEffect, useCallback } from "react";
import type { ApiInstance } from "../hooks/useApi";
import type { TcCamera } from "../types";

interface Props {
  api: ApiInstance;
  blickrichtung: { x: number; y: number; z: number };
  schnittPos: { x: number; y: number; z: number };
  onClose: () => void;
}

const MASSSTAB_OPTIONEN = [
  { label: "1:20", wert: 20 },
  { label: "1:50", wert: 50 },
  { label: "1:100", wert: 100 },
  { label: "1:200", wert: 200 },
  { label: "1:500", wert: 500 },
];

const PAPIER_OPTIONEN = [
  { label: "A4 quer", breiteMM: 297, hoeheMM: 210, nutzBreiteMM: 277, nutzHoeheMM: 190 },
  { label: "A4 hoch", breiteMM: 210, hoeheMM: 297, nutzBreiteMM: 190, nutzHoeheMM: 277 },
  { label: "A3 quer", breiteMM: 420, hoeheMM: 297, nutzBreiteMM: 400, nutzHoeheMM: 277 },
  { label: "A3 hoch", breiteMM: 297, hoeheMM: 420, nutzBreiteMM: 277, nutzHoeheMM: 400 },
];

export default function DruckDialog({ api, blickrichtung, schnittPos, onClose }: Props) {
  const [massstabIdx, setMassstabIdx] = useState(2); // 1:100
  const [papierIdx, setPapierIdx] = useState(0); // A4 quer
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [bildOffset, setBildOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const vorschauRef = useRef<HTMLDivElement>(null);

  const massstab = MASSSTAB_OPTIONEN[massstabIdx];
  const papier = PAPIER_OPTIONEN[papierIdx];

  // OrthoSize: sichtbare Modellbreite in Metern
  const orthoSize = (papier.nutzBreiteMM / 1000) * massstab.wert;

  // Vorschau-Skalierung: Papier passt in Extension-Panel (~320px breit)
  const vorschauBreite = 300;
  const vorschauHoehe = (papier.hoeheMM / papier.breiteMM) * vorschauBreite;

  // ─── Kamera ausrichten + Snapshot ───
  const snapshotErstellen = useCallback(async () => {
    setLaedt(true);
    setStatus("Kamera wird ausgerichtet…");
    try {
      const nx = blickrichtung.x;
      const ny = blickrichtung.y;
      const nz = blickrichtung.z;
      const abstand = 0.1; // Ortho braucht kaum Abstand

      let camPos: { x: number; y: number; z: number };
      let upDir: { x: number; y: number; z: number };

      if (Math.abs(nz) > 0.5) {
        // Grundriss
        camPos = { x: schnittPos.x, y: schnittPos.y, z: schnittPos.z + abstand * (nz > 0 ? 1 : -1) };
        upDir = { x: 0, y: 1, z: 0 };
      } else {
        // Schnitt
        camPos = { x: schnittPos.x + nx * abstand, y: schnittPos.y + ny * abstand, z: schnittPos.z };
        upDir = { x: 0, y: 0, z: 1 };
      }

      const neueKamera: TcCamera = {
        position: camPos,
        lookAt: schnittPos,
        upDirection: upDir,
        projectionType: "orthographic",
        orthoSize,
      };

      await api.viewer.setCamera(neueKamera);
      // Kurz warten damit TC rendert
      await new Promise(r => setTimeout(r, 500));

      setStatus("Snapshot wird erstellt…");
      const url = await api.viewer.getSnapshot();
      setSnapshotUrl(url);
      setBildOffset({ x: 0, y: 0 });
      setStatus(null);
    } catch (e) {
      setStatus(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }, [api, blickrichtung, schnittPos, orthoSize]);

  // Snapshot beim Öffnen und bei Änderungen erstellen
  useEffect(() => {
    snapshotErstellen();
  }, [snapshotErstellen]);

  // ─── Drag-Handling ───
  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: bildOffset.x, oy: bildOffset.y };
  }

  useEffect(() => {
    if (!isDragging) return;
    function handleMouseMove(e: MouseEvent) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setBildOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
    }
    function handleMouseUp() { setIsDragging(false); }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // ─── PDF Export ───
  async function pdfExportieren() {
    setLaedt(true);
    setStatus("PDF wird erstellt…");
    try {
      // Dynamisch importieren damit der Build nicht fehlschlägt wenn jsPDF fehlt
      const { jsPDF } = await import("jspdf");

      const istQuer = papier.breiteMM > papier.hoeheMM;
      const format = papier.breiteMM === 297 || papier.hoeheMM === 297
        ? (papier.breiteMM === 420 || papier.hoeheMM === 420 ? "a3" : "a4")
        : "a4";

      const pdf = new jsPDF({
        orientation: istQuer ? "landscape" : "portrait",
        unit: "mm",
        format,
      });

      // Rand
      const randMM = 10;
      const nutzB = papier.breiteMM - 2 * randMM;
      const nutzH = papier.hoeheMM - 2 * randMM;

      // Bild-Offset in mm umrechnen (Vorschau-Pixel → mm)
      const pxProMM = vorschauBreite / papier.breiteMM;
      const offsetXmm = bildOffset.x / pxProMM;
      const offsetYmm = bildOffset.y / pxProMM;

      // Snapshot als Bild einfügen
      if (snapshotUrl) {
        pdf.addImage(
          snapshotUrl,
          "PNG",
          randMM + offsetXmm,
          randMM + offsetYmm,
          nutzB,
          nutzH
        );
      }

      // Rahmen
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.3);
      pdf.rect(randMM, randMM, nutzB, nutzH);

      // Massstabsleiste unten links
      const leisteY = papier.hoeheMM - randMM - 3;
      const leisteXstart = randMM + 2;
      // Bei 1:100, 10mm auf Papier = 1m real
      const meterProMM = massstab.wert / 1000; // z.B. 1:100 → 0.1m pro mm Papier
      const leisteLaengeMM = 50; // 50mm auf Papier
      const leisteMeter = leisteLaengeMM * meterProMM;

      pdf.setLineWidth(0.5);
      pdf.line(leisteXstart, leisteY, leisteXstart + leisteLaengeMM, leisteY);
      // Endstriche
      pdf.line(leisteXstart, leisteY - 2, leisteXstart, leisteY + 2);
      pdf.line(leisteXstart + leisteLaengeMM, leisteY - 2, leisteXstart + leisteLaengeMM, leisteY + 2);

      pdf.setFontSize(7);
      pdf.text(`0`, leisteXstart, leisteY - 3);
      pdf.text(`${leisteMeter.toFixed(0)}m`, leisteXstart + leisteLaengeMM - 3, leisteY - 3);

      // Format + Massstab rechts unten
      pdf.setFontSize(8);
      const infoText = `${massstab.label}  |  ${papier.label}`;
      pdf.text(infoText, papier.breiteMM - randMM - 2, papier.hoeheMM - randMM - 3, { align: "right" });

      // Datum
      const datum = new Date().toLocaleDateString("de-CH");
      pdf.text(datum, papier.breiteMM - randMM - 2, papier.hoeheMM - randMM - 8, { align: "right" });

      pdf.save(`Schnitt_${massstab.label}_${datum}.pdf`);
      setStatus("✓ PDF gespeichert");
    } catch (e) {
      setStatus(`PDF-Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div style={{
      position: "absolute", inset: 0, background: "var(--tc-bg, #fff)",
      zIndex: 100, display: "flex", flexDirection: "column", overflow: "auto"
    }}>
      {/* Header */}
      <div style={{
        padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--tc-border, #ddd)", background: "var(--tc-header-bg, #1c4e7a)", color: "#fff"
      }}>
        <strong>🖨 Drucken</strong>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16
        }}>✕</button>
      </div>

      {/* Einstellungen */}
      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, marginBottom: 2 }}>Massstab</div>
            <select className="tc-input" value={massstabIdx}
              onChange={e => setMassstabIdx(Number(e.target.value))}>
              {MASSSTAB_OPTIONEN.map((m, i) => (
                <option key={i} value={i}>{m.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, marginBottom: 2 }}>Format</div>
            <select className="tc-input" value={papierIdx}
              onChange={e => setPapierIdx(Number(e.target.value))}>
              {PAPIER_OPTIONEN.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "var(--tc-text-3)", marginBottom: 4 }}>
          Sichtbereich: {orthoSize.toFixed(1)}m × {((papier.nutzHoeheMM / 1000) * massstab.wert).toFixed(1)}m
        </div>
        <button className="tc-btn-secondary" style={{ width: "100%", marginBottom: 8 }}
          disabled={laedt} onClick={snapshotErstellen}>
          🔄 Ansicht aktualisieren
        </button>
      </div>

      {/* Papier-Vorschau */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 10px 8px" }}>
        <div
          ref={vorschauRef}
          style={{
            width: vorschauBreite,
            height: vorschauHoehe,
            background: "#fff",
            border: "2px solid #333",
            position: "relative",
            overflow: "hidden",
            cursor: isDragging ? "grabbing" : "grab",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
          onMouseDown={handleMouseDown}
        >
          {snapshotUrl ? (
            <img
              src={snapshotUrl}
              alt="Vorschau"
              draggable={false}
              style={{
                position: "absolute",
                left: `${(vorschauBreite * 10 / papier.breiteMM) + bildOffset.x}px`,
                top: `${(vorschauHoehe * 10 / papier.hoeheMM) + bildOffset.y}px`,
                width: `${vorschauBreite * (papier.breiteMM - 20) / papier.breiteMM}px`,
                height: `${vorschauHoehe * (papier.hoeheMM - 20) / papier.hoeheMM}px`,
                objectFit: "contain",
                pointerEvents: "none",
              }}
            />
          ) : (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 11, color: "#999"
            }}>
              {laedt ? "Lade…" : "Kein Snapshot"}
            </div>
          )}

          {/* Massstab-Anzeige */}
          <div style={{
            position: "absolute", bottom: 6, left: 8,
            fontSize: 8, color: "#333", fontFamily: "monospace"
          }}>
            ├────────┤ {((50 * massstab.wert) / 1000).toFixed(0)}m
          </div>

          {/* Format + Massstab */}
          <div style={{
            position: "absolute", bottom: 6, right: 8,
            fontSize: 8, color: "#333", textAlign: "right"
          }}>
            {massstab.label} | {papier.label}
          </div>
        </div>
      </div>

      {/* Aktionen */}
      <div style={{ padding: "0 10px 10px", display: "flex", gap: 6 }}>
        <button className="tc-btn-primary" style={{ flex: 1 }}
          disabled={laedt || !snapshotUrl} onClick={pdfExportieren}>
          📄 PDF speichern
        </button>
        <button className="tc-btn-ghost" onClick={onClose}>
          Abbrechen
        </button>
      </div>

      {status && (
        <div style={{
          padding: "6px 10px", fontSize: 10,
          color: status.startsWith("✓") ? "#2e7d32" : "#b00",
          background: status.startsWith("✓") ? "#e8f5e9" : "#fff0f0",
          borderTop: "1px solid #ddd"
        }}>
          {status}
        </div>
      )}
    </div>
  );
}
