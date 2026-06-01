import { useState } from "react";
import * as XLSX from "xlsx";
import type { Task, TaskTyp } from "../types";

interface Props {
  tasks: Task[];
  setTasks: (t: Task[]) => void;
  ganttAktualisieren: (t: Task[]) => void;
  onNachImport?: (t: Task[]) => void;
  kompakt?: boolean;
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
            if (id && name && name !== "0")
              tasks.push({ id, name, start, end, typ: "neubau", objektGuids: [] });
          });
          resolve(tasks);
        } catch { reject("XML konnte nicht gelesen werden."); }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          if (rows.length === 0) throw new Error("Keine Zeilen gefunden.");
          const tasks: Task[] = rows.map((row, i) => ({
            id: String(i + 1),
            name: String(row["Name"] || row["Aufgabe"] || row["Task"] || ""),
            start: String(row["Start"] || row["Startdatum"] || ""),
            end: String(row["Ende"] || row["Enddatum"] || row["Finish"] || ""),
            typ: (String(row["Typ"] || "neubau").toLowerCase() as TaskTyp),
            objektGuids: [],
          }));
          resolve(tasks);
        } catch (e) { reject(String(e)); }
      };
      reader.readAsArrayBuffer(file);
    }
  });
}

export default function GanttImport({ tasks, setTasks, ganttAktualisieren, onNachImport, kompakt }: Props) {
  const [fehler, setFehler] = useState("");
  const [erfolg, setErfolg] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFehler(""); setErfolg("");
    try {
      const geladen = await parseFile(file);
      if (geladen.length === 0) {
        setFehler("Ungültige Datei – keine Tasks gefunden.");
        return;
      }
      if (tasks.length > 0) ganttAktualisieren(geladen);
      else setTasks(geladen);
      onNachImport?.(geladen);
      setErfolg(`✓ ${geladen.length} Tasks importiert`);
    } catch (err) {
      setFehler(`Ungültige Datei – ${String(err)}`);
    }
    e.target.value = "";
  }

  return (
    <div>
      {!kompakt && (
        <div style={{ marginBottom: 10 }}>
          <button className="vorlage-dl-btn" onClick={downloadVorlage}>
            ⬇ Gantt-Vorlage herunterladen (.xlsx)
          </button>
        </div>
      )}

      <label className="gantt-upload" style={kompakt ? { padding: "10px", marginBottom: 8 } : {}}>
        <div className="gantt-upload-icon" style={kompakt ? { fontSize: 20, marginBottom: 2 } : {}}>📂</div>
        <div className="gantt-upload-text" style={kompakt ? { fontSize: 12 } : {}}>
          {tasks.length > 0 ? "Gantt ersetzen" : "Gantt importieren"}
        </div>
        <div className="gantt-upload-hint">
          {tasks.length > 0 ? "Verknüpfungen bleiben erhalten" : "xlsx oder xml · Pflicht: Name, Start, Ende, Typ"}
        </div>
        <input type="file" accept=".xlsx,.xml" onChange={onFile} style={{ display: "none" }} />
      </label>

      {fehler && <div className="gantt-error">⚠ {fehler}</div>}
      {erfolg && <div className="gantt-success">{erfolg}</div>}

      {kompakt && (
        <button className="vorlage-dl-btn" onClick={downloadVorlage} style={{ fontSize: 11, padding: "5px 10px" }}>
          ⬇ Vorlage
        </button>
      )}
    </div>
  );
}