import { useState } from "react";
import * as XLSX from "xlsx";
import type { Task, TaskTyp } from "../types";

interface Props {
  tasks: Task[];
  setTasks: (t: Task[]) => void;
  ganttAktualisieren: (t: Task[]) => void;
}

const VORLAGE = [
  ["Name", "Start", "Ende", "Typ"],
  ["Erdarbeiten", "2024-01-01", "2024-01-15", "neubau"],
  ["Fundament", "2024-01-16", "2024-02-01", "neubau"],
  ["Bestandswand", "2024-01-01", "2024-03-31", "bestand"],
  ["Abbruch Altbau", "2024-02-01", "2024-02-15", "abbruch"],
  ["Rohbau EG", "2024-02-16", "2024-03-15", "neubau"],
];

function downloadVorlage() {
  const ws = XLSX.utils.aoa_to_sheet(VORLAGE);
  ws["!cols"] = [{ wch: 22 }, { wch: 13 }, { wch: 13 }, { wch: 11 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gantt");
  XLSX.writeFile(wb, "Gantt_Vorlage_4D.xlsx");
}

async function parseFile(file: File): Promise<Task[]> {
  return new Promise((resolve, reject) => {
    if (file.name.endsWith(".xml")) {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const xml = new DOMParser().parseFromString(ev.target?.result as string, "text/xml");
          const els = xml.querySelectorAll("Task");
          const tasks: Task[] = [];
          els.forEach(t => {
            const id = t.querySelector("UID")?.textContent || "";
            const name = t.querySelector("Name")?.textContent || "";
            const start = t.querySelector("Start")?.textContent?.slice(0, 10) || "";
            const end = t.querySelector("Finish")?.textContent?.slice(0, 10) || "";
            if (id && name && name !== "0") tasks.push({ id, name, start, end, typ: "neubau", objektGuids: [] });
          });
          resolve(tasks);
        } catch { reject("XML Fehler"); }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          const tasks: Task[] = rows.map((row, i) => ({
            id: String(i + 1),
            name: row["Name"] || row["Aufgabe"] || row["Task"] || `Task ${i + 1}`,
            start: row["Start"] || row["Startdatum"] || "",
            end: row["Ende"] || row["Enddatum"] || row["Finish"] || "",
            typ: (row["Typ"] as TaskTyp) || "neubau",
            objektGuids: [],
          }));
          resolve(tasks);
        } catch { reject("Excel Fehler"); }
      };
      reader.readAsArrayBuffer(file);
    }
  });
}

export default function GanttImport({ tasks, setTasks, ganttAktualisieren }: Props) {
  const [fehler, setFehler] = useState("");
  const [preview, setPreview] = useState(false);
  const hatTasks = tasks.length > 0;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFehler("");
    try {
      const geladen = await parseFile(file);
      if (hatTasks) ganttAktualisieren(geladen);
      else setTasks(geladen);
    } catch { setFehler("Datei konnte nicht gelesen werden."); }
    e.target.value = "";
  }

  return (
    <div>
      <label className="gantt-upload">
        <div className="gantt-upload-icon">📂</div>
        <div className="gantt-upload-text">{hatTasks ? "Gantt ersetzen" : "Datei auswählen"}</div>
        <div className="gantt-upload-hint">
          {hatTasks ? "Bestehende Verknüpfungen bleiben erhalten" : "xlsx oder xml"}
        </div>
        <input type="file" accept=".xlsx,.xml" onChange={onFile} style={{ display: "none" }} />
      </label>

      {fehler && <div className="gantt-error">{fehler}</div>}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tc-text-2)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Excel-Vorlage</div>
        <div className="vorlage-box">
          <table>
            <thead><tr>{["Name", "Start", "Ende", "Typ"].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {VORLAGE.slice(1).map((row, i) => (
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
        <button className="vorlage-dl-btn" onClick={downloadVorlage}>⬇ Vorlage herunterladen</button>
      </div>

      {hatTasks && (
        <div className="gantt-preview">
          <div className="gantt-preview-header">
            <span>{tasks.length} Tasks geladen</span>
            <span style={{ color: "var(--tc-blue)", cursor: "pointer" }} onClick={() => setPreview(!preview)}>
              {preview ? "Ausblenden" : "Vorschau"}
            </span>
          </div>
          {preview && tasks.map(t => (
            <div key={t.id} className="gantt-row">
              <span className={`gantt-dot ${t.typ}`} />
              <span className="gantt-name">{t.name}</span>
              <span className="gantt-date">{t.start}</span>
              {t.objektGuids.length > 0 && <span style={{ fontSize: 10, color: "var(--tc-blue)" }}>⬡ {t.objektGuids.length}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}