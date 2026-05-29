import { useState } from "react";
import * as XLSX from "xlsx";
import type { Task, TaskTyp } from "../types";

interface Props {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
}

export default function GanttImport({ tasks, setTasks }: Props) {
  const [fehler, setFehler] = useState<string>("");

  function dateiLaden(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    if (!datei) return;
    setFehler("");

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
          setTasks(geladen);
        } catch {
          setFehler("XML-Datei konnte nicht gelesen werden.");
        }
      };
      reader.readAsText(datei);
      return;
    }

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
          typ: "neubau" as TaskTyp,
          objektGuids: [],
        }));
        setTasks(geladen);
      } catch {
        setFehler("Excel-Datei konnte nicht gelesen werden.");
      }
    };
    reader.readAsArrayBuffer(datei);
  }

  return (
    <div className="panel">
      <h2>Gantt-Datei laden</h2>
      <p className="hinweis">Excel (.xlsx) oder MS Project als XML (.xml)</p>
      <input type="file" accept=".xlsx,.xml" onChange={dateiLaden} />
      {fehler && <p className="fehler">{fehler}</p>}
      {tasks.length > 0 && (
        <div className="task-liste">
          <p className="erfolg">✓ {tasks.length} Tasks geladen</p>
          {tasks.map((t) => (
            <div key={t.id} className="task-item">
              <span className="task-name">{t.name}</span>
              <span className="task-datum">{t.start} – {t.end}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}