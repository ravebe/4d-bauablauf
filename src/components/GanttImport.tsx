import { useState } from "react";
import * as XLSX from "xlsx";
import type { Task, TaskTyp } from "../types";

interface Props {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  ganttAktualisieren: (tasks: Task[]) => void;
}

const VORLAGE_DATEN = [
  ["Name", "Start", "Ende", "Typ"],
  ["Erdarbeiten", "2024-01-01", "2024-01-15", "neubau"],
  ["Fundament", "2024-01-16", "2024-02-01", "neubau"],
  ["Bestandswand Nord", "2024-01-01", "2024-03-31", "bestand"],
  ["Abbruch Altbau", "2024-02-01", "2024-02-15", "abbruch"],
  ["Rohbau EG", "2024-02-16", "2024-03-15", "neubau"],
  ["Rohbau OG1", "2024-03-16", "2024-04-15", "neubau"],
];

function vorlageHerunterladen() {
  const ws = XLSX.utils.aoa_to_sheet(VORLAGE_DATEN);
  ws["!cols"] = [{ wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gantt");
  XLSX.writeFile(wb, "Gantt_Vorlage_4D.xlsx");
}

function parseDatei(datei: File): Promise<Task[]> {
  return new Promise((resolve, reject) => {
    if (datei.name.endsWith(".xml")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const parser = new DOMParser();
          const xml = parser.parseFromString(text, "text/xml");
          const taskElems = xml.querySelectorAll("Task");
          const geladen: Task[] = [];
          taskElems.forEach((t) => {
            const id = t.querySelector("UID")?.textContent || "";
            const name = t.querySelector("Name")?.textContent || "";
            const start = t.querySelector("Start")?.textContent?.slice(0, 10) || "";
            const end = t.querySelector("Finish")?.textContent?.slice(0, 10) || "";
            if (id && name && name !== "0") {
              geladen.push({ id, name, start, end, typ: "neubau" as TaskTyp, objektGuids: [] });
            }
          });
          resolve(geladen);
        } catch { reject("XML Fehler"); }
      };
      reader.readAsText(datei);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet);
          const geladen: Task[] = rows.map((row, i) => ({
            id: String(i + 1),
            name: row["Name"] || row["Aufgabe"] || row["Task"] || `Task ${i + 1}`,
            start: row["Start"] || row["Startdatum"] || "",
            end: row["Ende"] || row["Enddatum"] || row["Finish"] || "",
            typ: (row["Typ"] as TaskTyp) || "neubau",
            objektGuids: [],
          }));
          resolve(geladen);
        } catch { reject("Excel Fehler"); }
      };
      reader.readAsArrayBuffer(datei);
    }
  });
}

export default function GanttImport({ tasks, setTasks, ganttAktualisieren }: Props) {
  const [fehler, setFehler] = useState("");
  const [vorschau, setVorschau] = useState(false);
  const [erstesMal, setErstesMal] = useState(tasks.length === 0);

  async function dateiLaden(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    if (!datei) return;
    setFehler("");
    try {
      const geladen = await parseDatei(datei);
      if (erstesMal || tasks.length === 0) {
        setTasks(geladen);
        setErstesMal(false);
      } else {
        ganttAktualisieren(geladen);
      }
    } catch {
      setFehler("Datei konnte nicht gelesen werden.");
    }
    e.target.value = "";
  }

  return (
    <div className="panel">
      <div className="section-header"><span>Gantt importieren</span></div>

      <div className="info-box">
        Unterstützt: Excel (.xlsx) oder MS Project Export (.xml)
      </div>

      <label className="upload-label">
        <div className="upload-icon">📂</div>
        <div className="upload-text">
          {tasks.length > 0 ? "Gantt ersetzen" : "Datei auswählen"}
        </div>
        <div className="upload-hint">
          {tasks.length > 0
            ? "Bestehende Bauteil-Verknüpfungen bleiben erhalten"
            : "xlsx oder xml"}
        </div>
        <input type="file" accept=".xlsx,.xml" onChange={dateiLaden} style={{ display: "none" }} />
      </label>

      {fehler && <div className="alert error">{fehler}</div>}

      <div className="section-header" style={{ marginTop: 14 }}>
        <span>Excel-Vorlage</span>
        <button className="btn-small" onClick={vorlageHerunterladen}>⬇ Herunterladen</button>
      </div>

      <p className="hinweis">Pflicht-Spalten: Name · Start · Ende · Typ</p>

      <div className="vorlage-tabelle">
        <table>
          <thead>
            <tr>{["Name", "Start", "Ende", "Typ"].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {VORLAGE_DATEN.slice(1).map((row, i) => (
              <tr key={i}>
                <td>{row[0]}</td>
                <td style={{ fontFamily: "monospace" }}>{row[1]}</td>
                <td style={{ fontFamily: "monospace" }}>{row[2]}</td>
                <td><span className={`typ-pill ${row[3]}`}>{row[3]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hinweis" style={{ marginTop: 4 }}>
        Datum: YYYY-MM-DD · Typ: neubau / bestand / abbruch
      </p>

      {tasks.length > 0 && (
        <>
          <div className="section-header" style={{ marginTop: 14 }}>
            <span className="success-text">✓ {tasks.length} Tasks geladen</span>
            <button className="btn-small" onClick={() => setVorschau(!vorschau)}>
              {vorschau ? "Ausblenden" : "Vorschau"}
            </button>
          </div>
          {vorschau && (
            <div className="task-liste">
              {tasks.map((t) => (
                <div key={t.id} className="task-item">
                  <span className={`typ-dot ${t.typ}`}>●</span>
                  <span className="task-name">{t.name}</span>
                  <span className="task-datum">{t.start}</span>
                  {t.objektGuids.length > 0 && (
                    <span className="guid-count">{t.objektGuids.length} 🔗</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}