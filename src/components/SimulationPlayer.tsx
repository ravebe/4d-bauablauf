import { useState } from "react";
import type { Task } from "../types";

interface Props {
  tasks: Task[];
  api: any;
  aktivesModellId: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SimulationPlayer({ tasks, api, aktivesModellId }: Props) {
  const [laeuft, setLaeuft] = useState(false);
  const [aktuellerTaskId, setAktuellerTaskId] = useState<string | null>(null);
  const [taskDauer, setTaskDauer] = useState(3);
  const [fortschritt, setFortschritt] = useState(0);

  const tasksMitBauteilen = tasks.filter(t => t.objektGuids.length > 0);

  async function simulationStarten() {
    if (!api || !aktivesModellId) return;
    setLaeuft(true);
    setFortschritt(0);

    // Alle Neubau-Bauteile verstecken
    const neubauGuids = tasks.filter(t => t.typ === "neubau").flatMap(t => t.objektGuids);
    if (neubauGuids.length > 0) {
      try {
        const ids = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, neubauGuids);
        await api.viewer.setObjectState({ visible: false }, ids);
      } catch {}
    }

    const zuSpielen = tasks.filter(t => t.objektGuids.length > 0);

    for (let i = 0; i < zuSpielen.length; i++) {
      const task = zuSpielen[i];
      setAktuellerTaskId(task.id);
      setFortschritt(Math.round((i / zuSpielen.length) * 100));

      let runtimeIds: number[] = [];
      try {
        runtimeIds = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, task.objektGuids);
      } catch { continue; }

      if (task.typ === "neubau") {
        await api.viewer.setObjectState({ visible: true, color: task.manuellefarbe ?? "reset" }, runtimeIds);
        await api.viewer.setSelection(runtimeIds);
        await sleep(taskDauer * 1000);
        await api.viewer.setSelection([]);
      }

      if (task.typ === "bestand") {
        await sleep(taskDauer * 1000);
      }

      if (task.typ === "abbruch") {
        await api.viewer.setObjectState({ color: { r: 255, g: 200, b: 0, a: 1 } }, runtimeIds);
        await sleep(2000);
        await api.viewer.setObjectState({ visible: false, color: "reset" }, runtimeIds);
        await api.viewer.setSelection([]);
        const rest = taskDauer * 1000 - 2000;
        if (rest > 0) await sleep(rest);
      }
    }

    setFortschritt(100);
    await api.viewer.setSelection([]);
    setAktuellerTaskId(null);
    setLaeuft(false);
  }

  async function simulationStoppen() {
    setLaeuft(false);
    setAktuellerTaskId(null);
    setFortschritt(0);
    if (api) {
      try { await api.viewer.setSelection([]); } catch {}
    }
  }

  if (!aktivesModellId) {
    return (
      <div className="panel">
        <div className="alert" style={{ background: "#2a1f00", borderLeft: "3px solid #ffa726", color: "#ffa726" }}>
          ⚠ Bitte zuerst unter "Modelle" ein IFC-Modell auswählen.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="section-header"><span>Simulation</span></div>

      {/* Einstellungen */}
      <div className="sub-section" style={{ marginBottom: 10 }}>
        <div className="sub-label">Einstellungen</div>
        <div className="einstellung">
          <label>Sekunden pro Task</label>
          <input
            type="number" min={1} max={30} value={taskDauer}
            onChange={(e) => setTaskDauer(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </div>
        <p className="hinweis">
          Abbruch: 2 Sek. gelb → ausgeblendet · Bestand: immer sichtbar
        </p>
      </div>

      {/* Task-Liste */}
      <div className="section-header">
        <span>Tasks ({tasksMitBauteilen.length} mit Bauteilen)</span>
      </div>

      {tasksMitBauteilen.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px", color: "#555" }}>
          <p style={{ fontSize: 11 }}>Keine Tasks mit Bauteilen.<br />Weise zuerst Bauteile zu.</p>
        </div>
      ) : (
        <div className="task-liste" style={{ marginBottom: 10 }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`sim-task-item ${aktuellerTaskId === task.id ? "aktiv" : ""}`}
            >
              <span className={`typ-dot ${task.typ}`}>●</span>
              <span className="task-name">{task.name}</span>
              <span className="task-datum">{task.objektGuids.length} Bauteile</span>
              {aktuellerTaskId === task.id && (
                <span style={{ fontSize: 10, color: "#4da6ff" }}>▶ läuft</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fortschritt */}
      {laeuft && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            height: 4, background: "#333", borderRadius: 2, overflow: "hidden"
          }}>
            <div style={{
              height: "100%", width: `${fortschritt}%`,
              background: "#4da6ff", transition: "width 0.3s"
            }} />
          </div>
          <p style={{ fontSize: 10, color: "#666", marginTop: 4, textAlign: "center" }}>
            {fortschritt}% abgeschlossen
          </p>
        </div>
      )}

      {/* Steuerung */}
      <div className="steuerung">
        {!laeuft ? (
          <button
            className="btn-start"
            onClick={simulationStarten}
            disabled={tasksMitBauteilen.length === 0}
          >
            ▶ Simulation starten
          </button>
        ) : (
          <button className="btn-stop" onClick={simulationStoppen}>
            ■ Simulation stoppen
          </button>
        )}
      </div>

      {aktuellerTaskId && (
        <div className="aktiver-task-info">
          ▶ Aktiv: {tasks.find(t => t.id === aktuellerTaskId)?.name}
        </div>
      )}
    </div>
  );
}