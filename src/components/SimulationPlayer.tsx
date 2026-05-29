import { useState } from "react";
import type { Task } from "../types";

interface Props {
  tasks: Task[];
  api: any;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SimulationPlayer({ tasks, api }: Props) {
  const [laeuft, setLaeuft] = useState(false);
  const [aktuellerTask, setAktuellerTask] = useState<string | null>(null);
  const [taskDauer, setTaskDauer] = useState(3);
  const [modelId, setModelId] = useState("");
  const [modelle, setModelle] = useState<any[]>([]);

  async function modelleAbrufen() {
    if (!api) return;
    try {
      const result = await api.viewer.getModels();
      setModelle(result);
      if (result.length > 0) setModelId(result[0].modelId || result[0].id);
    } catch (err) {
      console.error("Modelle konnten nicht geladen werden:", err);
    }
  }

  async function simulationStarten() {
    if (!api || tasks.length === 0) return;
    setLaeuft(true);

    // Schritt 1: Alle Neubau-Bauteile verstecken
    const neubauGuids = tasks
      .filter((t) => t.typ === "neubau")
      .flatMap((t) => t.objektGuids);

    if (neubauGuids.length > 0) {
      const neubauIds = await api.viewer.convertToObjectRuntimeIds(
        modelId, neubauGuids
      );
      await api.viewer.setObjectState({ visible: false }, neubauIds);
    }

    // Schritt 2: Tasks nacheinander abspielen
    for (const task of tasks) {
      if (task.objektGuids.length === 0) continue;
      setAktuellerTask(task.id);

      const runtimeIds = await api.viewer.convertToObjectRuntimeIds(
        modelId, task.objektGuids
      );

      if (task.typ === "neubau") {
        // Einblenden + markieren
        await api.viewer.setObjectState(
          { visible: true, color: task.manuellefarbe ?? "reset" },
          runtimeIds
        );
        await api.viewer.setSelection(runtimeIds);
        await sleep(taskDauer * 1000);
        await api.viewer.setSelection([]);
      }

      if (task.typ === "bestand") {
        // Nur warten – immer sichtbar, keine Markierung
        await sleep(taskDauer * 1000);
      }

      if (task.typ === "abbruch") {
        // 2 Sekunden gelb aufleuchten
        await api.viewer.setObjectState(
          { color: { r: 255, g: 200, b: 0, a: 1 } },
          runtimeIds
        );
        await sleep(2000);
        // Ausblenden + Farbe zurücksetzen
        await api.viewer.setObjectState(
          { visible: false, color: "reset" },
          runtimeIds
        );
        await api.viewer.setSelection([]);
        const restzeit = taskDauer * 1000 - 2000;
        if (restzeit > 0) await sleep(restzeit);
      }
    }

    setAktuellerTask(null);
    setLaeuft(false);
  }

  async function simulationStoppen() {
    setLaeuft(false);
    setAktuellerTask(null);
    if (api) await api.viewer.setSelection([]);
  }

  return (
    <div className="panel">
      <h2>Simulation</h2>

      {/* Modell wählen */}
      <div className="einstellung">
        <label>IFC-Modell:</label>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
          {modelle.map((m) => (
            <option key={m.modelId || m.id} value={m.modelId || m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button onClick={modelleAbrufen}>Modelle laden</button>
      </div>

      {/* Task-Dauer */}
      <div className="einstellung">
        <label>Sekunden pro Task:</label>
        <input
          type="number"
          min={1}
          max={30}
          value={taskDauer}
          onChange={(e) => setTaskDauer(Number(e.target.value))}
        />
        <span>Sek.</span>
      </div>

      {/* Task-Übersicht */}
      <div className="task-liste">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`task-item ${aktuellerTask === task.id ? "aktiv" : ""}`}
          >
            <span className={`typ-punkt ${task.typ}`}>●</span>
            <span className="task-name">{task.name}</span>
            <span className="task-datum">
              {task.objektGuids.length} Bauteile
            </span>
          </div>
        ))}
      </div>

      {/* Steuerung */}
      <div className="steuerung">
        {!laeuft ? (
          <button
            className="start-btn"
            onClick={simulationStarten}
            disabled={tasks.length === 0 || !modelId}
          >
            ▶ Simulation starten
          </button>
        ) : (
          <button className="stop-btn" onClick={simulationStoppen}>
            ■ Stoppen
          </button>
        )}
      </div>

      {aktuellerTask && (
        <p className="aktiver-task">
          Läuft: {tasks.find((t) => t.id === aktuellerTask)?.name}
        </p>
      )}
    </div>
  );
}