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
  { label: "A4 quer", breiteMM: 297, hoeheMM: 210, rand: 10 },
  { label: "A4 hoch", breiteMM: 210, hoeheMM: 297, rand: 10 },
  { label: "A3 quer", breiteMM: 420, hoeheMM: 297, rand: 10 },
  { label: "A3 hoch", breiteMM: 297, hoeheMM: 420, rand: 10 },
];

/** Base64 aus jsPDF-Output extrahieren */
function pdfToBase64(pdf: any): string {
  const raw = pdf.output("datauristring") as string;
  // Format: "data:application/pdf;filename=...;base64,XXXX"
  const idx = raw.indexOf("base64,");
  return idx >= 0 ? raw.substring(idx + 7) : raw;
}

export default function DruckDialog({ api, blickrichtung, schnittPos, onClose }: Props) {
  const [massstabIdx, setMassstabIdx] = useState(2);
  const [papierIdx, setPapierIdx] = useState(0);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [bildOffset, setBildOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const massstab = MASSSTAB_OPTIONEN[massstabIdx];
  const papier = PAPIER_OPTIONEN[papierIdx];
  const nutzB = papier.breiteMM - 2 * papier.rand;
  const nutzH = papier.hoeheMM - 2 * papier.rand;
  const orthoSize = (nutzB / 1000) * massstab.wert;

  const vorschauBreite = 300;
  const vorschauHoehe = (papier.hoeheMM / papier.breiteMM) * vorschauBreite;
  const randPx = (papier.rand / papier.breiteMM) * vorschauBreite;

  // ─── Kamera + Snapshot ───
  const snapshotErstellen = useCallback(async () => {
    setLaedt(true);
    setStatus("Kamera wird ausgerichtet…");
    try {
      const nx = blickrichtung.x, ny = blickrichtung.y, nz = blickrichtung.z;
      let camPos: { x: number; y: number; z: number };
      let upDir: { x: number; y: number; z: number };

      if (Math.abs(nz) > 0.5) {
        camPos = { x: schnittPos.x, y: schnittPos.y, z: schnittPos.z + 0.1 * (nz > 0 ? 1 : -1) };
        upDir = { x: 0, y: 1, z: 0 };
      } else {
        camPos = { x: schnittPos.x + nx * 0.1, y: schnittPos.y + ny * 0.1, z: schnittPos.z };
        upDir = { x: 0, y: 0, z: 1 };
      }

      const neueKamera: TcCamera = {
        position: camPos, lookAt: schnittPos, upDirection: upDir,
        projectionType: "orthographic", orthoSize,
      };

      await api.viewer.setCamera(neueKamera);
      await new Promise(r => setTimeout(r, 800));

      setStatus("Snapshot…");
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

  useEffect(() => { snapshotErstellen(); }, [snapshotErstellen]);

  // ─── Drag ───
  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: bildOffset.x, oy: bildOffset.y };
  }
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => setBildOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isDragging]);

  // ─── PDF erstellen (shared) ───
  async function erstellePDF(): Promise<any> {
    const { jsPDF } = await import("jspdf");
    const istQuer = papier.breiteMM > papier.hoeheMM;
    const dinFormat = (papier.breiteMM === 420 || papier.hoeheMM === 420) ? "a3" : "a4";

    const pdf = new jsPDF({ orientation: istQuer ? "landscape" : "portrait", unit: "mm", format: dinFormat });
    const rand = papier.rand;

    if (snapshotUrl) {
      const imgAR = await new Promise<number>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.width / img.height);
        img.src = snapshotUrl!;
      });

      const papierAR = nutzB / nutzH;
      let bildW: number, bildH: number;
      if (imgAR > papierAR) { bildW = nutzB; bildH = nutzB / imgAR; }
      else { bildH = nutzH; bildW = nutzH * imgAR; }

      const pxProMM = vorschauBreite / papier.breiteMM;
      const bildX = rand + (nutzB - bildW) / 2 + bildOffset.x / pxProMM;
      const bildY = rand + (nutzH - bildH) / 2 + bildOffset.y / pxProMM;

      pdf.addImage(snapshotUrl, "PNG", bildX, bildY, bildW, bildH);
    }

    // Rahmen
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.2);
    pdf.rect(rand, rand, nutzB, nutzH);

    // Massstabsleiste
    const leisteY = papier.hoeheMM - rand - 4;
    const leisteX = rand + 3;
    const leisteMM = 50;
    const leisteMeter = leisteMM * massstab.wert / 1000;

    pdf.setLineWidth(0.3);
    pdf.line(leisteX, leisteY, leisteX + leisteMM, leisteY);
    pdf.line(leisteX, leisteY - 1.5, leisteX, leisteY + 1.5);
    pdf.line(leisteX + leisteMM, leisteY - 1.5, leisteX + leisteMM, leisteY + 1.5);
    pdf.line(leisteX + leisteMM / 2, leisteY - 1, leisteX + leisteMM / 2, leisteY + 1);

    pdf.setFontSize(6);
    pdf.text("0", leisteX, leisteY - 2.5);
    pdf.text(`${leisteMeter.toFixed(0)}m`, leisteX + leisteMM - 2, leisteY - 2.5);

    // Plankopf
    const kopfX = papier.breiteMM - rand - 3;
    const kopfY = papier.hoeheMM - rand - 3;
    pdf.setFontSize(7);
    pdf.text(`${massstab.label}  |  ${papier.label}`, kopfX, kopfY, { align: "right" });
    pdf.text(new Date().toLocaleDateString("de-CH"), kopfX, kopfY - 4, { align: "right" });
    pdf.setLineWidth(0.1);
    pdf.line(kopfX - 50, kopfY - 7, kopfX, kopfY - 7);

    return pdf;
  }

  // ─── Lokal speichern ───
  async function pdfSpeichern() {
    if (!snapshotUrl) return;
    setLaedt(true);
    setStatus("PDF wird erstellt…");
    try {
      const pdf = await erstellePDF();
      const datum = new Date().toLocaleDateString("de-CH").replace(/\./g, "_");
      pdf.save(`Schnitt_${massstab.label.replace(":", "_")}_${datum}.pdf`);
      setStatus("✓ PDF lokal gespeichert");
    } catch (e) {
      setStatus(`PDF-Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  // ─── In TC hochladen ───
  async function inTcHochladen() {
    if (!snapshotUrl) return;
    setLaedt(true);
    setStatus("PDF wird erstellt und hochgeladen…");
    try {
      const pdf = await erstellePDF();
      const base64 = pdfToBase64(pdf);

      // Access Token holen
      let accessToken: string;
      try {
        accessToken = await api.extension.requestPermission("accesstoken");
      } catch {
        setStatus("Fehler: Kein Access Token erhalten — Berechtigung verweigert");
        return;
      }

      // Projekt-ID holen
      let projectId: string;
      try {
        const proj = await api.project.getProject();
        projectId = proj.id;
      } catch {
        setStatus("Fehler: Projekt-ID nicht verfügbar");
        return;
      }

      const datum = new Date().toLocaleDateString("de-CH").replace(/\./g, "_");
      const fileName = `Schnitt_${massstab.label.replace(":", "_")}_${datum}.pdf`;

      // Upload via Serverless Proxy
      const uploadRes = await fetch("/api/tc-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fileName,
          fileBase64: base64,
          accessToken,
          region: "europe",
        }),
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        setStatus(`Upload fehlgeschlagen: ${(err as any).error || uploadRes.status}`);
        return;
      }

      const result = await uploadRes.json();
      const fileId = result.fileId;

      // TC 2D-Viewer öffnen mit dem hochgeladenen PDF
      if (fileId) {
        const viewerUrl = `https://web.connect.trimble.com/projects/${projectId}/viewer/2d?fileVersionId=${fileId}`;
        window.open(viewerUrl, "_blank");
        setStatus(`✓ PDF hochgeladen und im 2D-Viewer geöffnet`);
      } else {
        setStatus(`✓ PDF hochgeladen (Ordner: Skizzentool) — manuell im 2D-Viewer öffnen`);
      }
    } catch (e) {
      setStatus(`Upload-Fehler: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLaedt(false);
    }
  }

  return (
    <div style={{
      position: "absolute", inset: 0, background: "var(--tc-bg, #f5f5f5)",
      zIndex: 100, display: "flex", flexDirection: "column", overflow: "auto"
    }}>
      {/* Header */}
      <div style={{
        padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--tc-border, #ddd)", background: "var(--tc-header-bg, #1c4e7a)", color: "#fff"
      }}>
        <strong style={{ fontSize: 12 }}>🖨 Drucken</strong>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>
      </div>

      {/* Einstellungen */}
      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, marginBottom: 2, color: "var(--tc-text-3)" }}>Massstab</div>
            <select className="tc-input" value={massstabIdx} onChange={e => setMassstabIdx(Number(e.target.value))}>
              {MASSSTAB_OPTIONEN.map((m, i) => (<option key={i} value={i}>{m.label}</option>))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, marginBottom: 2, color: "var(--tc-text-3)" }}>Format</div>
            <select className="tc-input" value={papierIdx} onChange={e => setPapierIdx(Number(e.target.value))}>
              {PAPIER_OPTIONEN.map((p, i) => (<option key={i} value={i}>{p.label}</option>))}
            </select>
          </div>
        </div>
        <div style={{ fontSize: 9, color: "var(--tc-text-3)", marginBottom: 6 }}>
          Sichtbereich: {orthoSize.toFixed(1)}m × {((nutzH / 1000) * massstab.wert).toFixed(1)}m — Bild verschiebbar
        </div>
        <button className="tc-btn-secondary" style={{ width: "100%", fontSize: 11 }}
          disabled={laedt} onClick={snapshotErstellen}>
          🔄 Ansicht aktualisieren
        </button>
      </div>

      {/* Vorschau */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "4px 10px 8px" }}>
        <div
          style={{
            width: vorschauBreite, height: vorschauHoehe, background: "#fff", border: "1px solid #999",
            position: "relative", overflow: "hidden", cursor: isDragging ? "grabbing" : "grab",
            boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
          }}
          onMouseDown={handleMouseDown}
        >
          <div style={{
            position: "absolute", left: randPx, top: randPx,
            width: vorschauBreite - 2 * randPx, height: vorschauHoehe - 2 * randPx,
            border: "0.5px solid #ccc", pointerEvents: "none",
          }} />

          {snapshotUrl ? (
            <img src={snapshotUrl} alt="Vorschau" draggable={false} style={{
              position: "absolute", left: randPx + bildOffset.x, top: randPx + bildOffset.y,
              width: vorschauBreite - 2 * randPx, height: vorschauHoehe - 2 * randPx,
              objectFit: "contain", pointerEvents: "none",
            }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#aaa" }}>
              {laedt ? "Lade…" : "Kein Snapshot"}
            </div>
          )}

          <div style={{ position: "absolute", bottom: 4, left: randPx + 2, fontSize: 7, color: "#333", fontFamily: "monospace" }}>
            ├──────┤ {((50 * massstab.wert) / 1000).toFixed(0)}m
          </div>
          <div style={{ position: "absolute", bottom: 4, right: randPx + 2, fontSize: 7, color: "#555", textAlign: "right" }}>
            {massstab.label} | {papier.label}
          </div>
        </div>
      </div>

      {/* Aktionen */}
      <div style={{ padding: "0 10px 6px" }}>
        <button className="tc-btn-primary" style={{ width: "100%", fontSize: 11, marginBottom: 4 }}
          disabled={laedt || !snapshotUrl} onClick={pdfSpeichern}>
          📄 PDF lokal speichern
        </button>
        <button className="tc-btn-secondary" style={{ width: "100%", fontSize: 11, marginBottom: 4 }}
          disabled={laedt || !snapshotUrl} onClick={inTcHochladen}>
          ☁ In TC hochladen & öffnen
        </button>
        <div style={{ fontSize: 9, color: "var(--tc-text-3)", marginBottom: 6 }}>
          Lädt das PDF in den Ordner «Skizzentool» und öffnet es im TC 2D-Viewer mit Messwerkzeugen.
        </div>
        <button className="tc-btn-ghost" style={{ width: "100%", fontSize: 11 }} onClick={onClose}>
          Schliessen
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