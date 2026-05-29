import { useState } from "react";
import type { Task, TaskTyp } from "../types";

interface Props {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  api: any;
}

export default function TaskList({ tasks, setTasks, api }: Props) {
  const [aktiverTask, setAktiverTask] = useState<string | null>(null);
  const [attributKey, setAttributKey] = useState("");
  const [attributValue, setAttributValue] = useState("");
  const [laden, setLaden] = useState(false);

  function typAendern(taskId: string, typ: TaskTyp) {
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, typ } : t)));
  }

  async function perAttributZuweisen(taskId: string) {
    if (!api || !attributKey || !attributValue) return;
    setLaden(true);
    try {
      const modelle = await api.viewer.getModels();
      const gefundeneGuids: string[] = [];

      for (const modell of modelle) {
        const objekte = await api.viewer.getObjects(modell.modelId || modell.id);
        const ids = objekte.map((o: any) => o.id);
        const eigenschaften = await api.viewer.getObjectProperties(
          modell.modelId || modell.id,
          ids
        );
        for (const obj of eigenschaften) {
          for (const gruppe of obj.properties || []) {
            for (const prop of gruppe.properties || []) {
              if (
                prop.name?.toLowerCase() === attributKey.toLowerCase() &&
                prop.value?.toLowerCase().includes(attributValue.toLowerCase())
              ) {
                gefundeneGuids.push(obj.id);
              }
            }
          }
        }
      }

      setTasks(
        tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                objektGuids: [
                  ...new Set([...t.objektGuids, ...gefundeneGuids]),
                ],
              }
            : t
        )
      );
    } catch (err) {
      console.error("Fehler bei Attribut-Filter:", err);
    } finally {
      setLaden(false);
    }
  }

  async function perKlickZuweisen(taskId: string) {
    if (!api) return;
    try {
      const selektion = await api.viewer.getSelection();
      const guids = selektion.map((s: any) => s.id);
      setTasks(
        tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                objektGuids: [...new Set([...t.objektGuids, ...guids])],
              }
            : t
        )
      );
    } catch (err) {
      console.error("Fehler bei Klick-Zuweisung:", err);
    }
  }

  function guidEntfernen(taskId: string, guid: string) {
    setTasks(
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, objektGuids: t.objektGuids.filter((g) => g !== guid) }
          : t
      )
    );
  }

  return (
    <div className="panel">
      <h2>Bauteile zuweisen</h2>
      {tasks.length === 0 && (
        <p className="hinweis">Bitte zuerst eine Gantt-Datei laden.</p>
      )}
      {tasks.map((task) => (
        <div key={task.id} className="task-card">
          <div
            className="task-header"
            onClick={() =>
              setAktiverTask(aktiverTask === task.id ? null : task.id)
            }
          >
            <span className="task-name">{task.name}</span>
            <span className="task-datum">
              {task.start} – {task.end}
            </span>
            <span className={`typ-badge ${task.typ}`}>
              {task.typ === "neubau" && "🟢 Neubau"}
              {task.typ === "bestand" && "🟡 Bestand"}
              {task.typ === "abbruch" && "🔴 Abbruch"}
            </span>
          </div>

          {aktiverTask === task.id && (
            <div className="task-detail">
              {/* Typ wählen */}
              <div className="typ-auswahl">
                <span>Typ:</span>
                {(["neubau", "bestand", "abbruch"] as TaskTyp[]).map((typ) => (
                  <button
                    key={typ}
                    className={task.typ === typ ? "active" : ""}
                    onClick={() => typAendern(task.id, typ)}
                  >
                    {typ}
                  </button>
                ))}
              </div>

              {/* Attribut-Filter */}
              <div className="attribut-filter">
                <p>Per IFC-Attribut zuweisen:</p>
                <input
                  placeholder="Attribut (z.B. Geschoss)"
                  value={attributKey}
                  onChange={(e) => setAttributKey(e.target.value)}
                />
                <input
                  placeholder="Wert (z.B. OG1)"
                  value={attributValue}
                  onChange={(e) => setAttributValue(e.target.value)}
                />
                <button
                  onClick={() => perAttributZuweisen(task.id)}
                  disabled={laden}
                >
                  {laden ? "Suche..." : "Bauteile suchen"}
                </button>
              </div>

              {/* Mausklick Zuweisung */}
              <div className="klick-zuweisung">
                <p>Per Mausklick im 3D Viewer zuweisen:</p>
                <p className="hinweis">
                  Wähle Bauteile im 3D Viewer an und klicke dann:
                </p>
                <button onClick={() => perKlickZuweisen(task.id)}>
                  Ausgewählte Bauteile übernehmen
                </button>
              </div>

              {/* Zugewiesene Bauteile */}
              <div className="guid-liste">
                <p>
                  Zugewiesene Bauteile: {task.objektGuids.length}
                </p>
                {task.objektGuids.map((guid) => (
                  <div key={guid} className="guid-item">
                    <span>{guid.slice(0, 20)}...</span>
                    <button
                      className="entfernen"
                      onClick={() => guidEntfernen(task.id, guid)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}