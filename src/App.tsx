import { useState } from "react";
import { useApi } from "./hooks/useApi";
import type { Task } from "./types";
import GanttImport from "./components/GanttImport";
import ModelSelector from "./components/ModelSelector";
import TaskList from "./components/TaskList";
import SimulationPlayer from "./components/SimulationPlayer";

type Phase = "setup" | "work";
type SetupStep = "modelle" | "gantt";

const STORAGE_KEY = "4d-projekt-v3";

function ladeProjekt(): { tasks: Task[]; modellIds: string[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { tasks: [], modellIds: [] };
}

function speichereProjekt(tasks: Task[], modellIds: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, modellIds })); } catch {}
}

export default function App() {
  const { api, connected, viewerState, setViewerState } = useApi();
  const gespeichert = ladeProjekt();
  const [phase, setPhase] = useState<Phase>(
    gespeichert.tasks.length > 0 ? "work" : "setup"
  );
  const [setupStep, setSetupStep] = useState<SetupStep>("modelle");
  const [tasks, setTasksRaw] = useState<Task[]>(gespeichert.tasks);
  const [aktivesModellId, setAktivesModellId] = useState<string>(
    gespeichert.modellIds[0] || ""
  );
  const [activeTab, setActiveTab] = useState<"tasks" | "simulation">("tasks");

  function setTasks(t: Task[]) {
    setTasksRaw(t);
    speichereProjekt(t, aktivesModellId ? [aktivesModellId] : []);
  }

  function ganttAktualisieren(neueTasks: Task[]) {
    const merged = neueTasks.map(neu => {
      const alt = tasks.find(t => t.name.toLowerCase() === neu.name.toLowerCase());
      return alt ? { ...neu, typ: alt.typ, objektGuids: alt.objektGuids } : neu;
    });
    setTasks(merged);
  }

  function modellSetzen(id: string) {
    setAktivesModellId(id);
    setViewerState(prev => ({ ...prev, aktivesModellId: id }));
    speichereProjekt(tasks, [id]);
  }

  function simulationNeu() {
    if (confirm("Neue Simulation starten? Alle Verknüpfungen werden gelöscht.")) {
      setTasksRaw([]);
      localStorage.removeItem(STORAGE_KEY);
      setPhase("setup");
      setSetupStep("modelle");
    }
  }

  // SETUP PHASE
  if (phase === "setup") {
    return (
      <div className="app">
        <header>
          <div className="header-left">
            <div className="app-icon">4D</div>
            <div>
              <div className="app-title">4D Bauablauf</div>
              <div className={`status ${connected ? "online" : "offline"}`}>
                {connected ? "● Verbunden" : "● Verbinde..."}
              </div>
            </div>
          </div>
        </header>

        <div className="setup-progress">
          <div className={`setup-step ${setupStep === "modelle" ? "aktiv" : "done"}`}>
            <span className="step-num">1</span>
            <span>Modell wählen</span>
          </div>
          <div className="step-line" />
          <div className={`setup-step ${setupStep === "gantt" ? "aktiv" : setupStep === "modelle" ? "" : "done"}`}>
            <span className="step-num">2</span>
            <span>Gantt laden</span>
          </div>
        </div>

        <main>
          {setupStep === "modelle" && (
            <div className="panel">
              <div className="section-header"><span>IFC-Modell wählen</span></div>
              <div className="info-box">
                Wähle das IFC-Modell für diese Simulation. Das Modell muss im 3D Viewer geladen sein.
              </div>
              <ModelSelector
                api={api}
                viewerState={viewerState}
                aktivesModellId={aktivesModellId}
                setAktivesModellId={modellSetzen}
              />
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn-primary"
                  disabled={!aktivesModellId}
                  onClick={() => setSetupStep("gantt")}
                >
                  Weiter → Gantt laden
                </button>
              </div>
            </div>
          )}

          {setupStep === "gantt" && (
            <div className="panel">
              <div className="section-header">
                <span>Gantt importieren</span>
                <button className="btn-xs" onClick={() => setSetupStep("modelle")}>← Zurück</button>
              </div>
              <GanttImport
                tasks={tasks}
                setTasks={setTasks}
                ganttAktualisieren={ganttAktualisieren}
              />
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn-start"
                  disabled={tasks.length === 0}
                  onClick={() => setPhase("work")}
                >
                  ▶ Simulation erstellen
                </button>
                {tasks.length === 0 && (
                  <p className="hinweis" style={{ marginTop: 6, textAlign: "center" }}>
                    Bitte zuerst eine Gantt-Datei laden.
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // WORK PHASE
  return (
    <div className="app">
      <header>
        <div className="header-left">
          <div className="app-icon">4D</div>
          <div>
            <div className="app-title">4D Bauablauf</div>
            <div className={`status ${connected ? "online" : "offline"}`}>
              {connected ? "● Verbunden" : "● Verbinde..."}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="task-count">{tasks.length} Tasks</span>
          <button
            style={{ background: "rgba(255,255,255,0.2)", color: "white", padding: "2px 8px", fontSize: 10 }}
            onClick={simulationNeu}
            title="Neue Simulation erstellen"
          >⟳ Neu</button>
        </div>
      </header>

      <nav>
        <button
          className={activeTab === "tasks" ? "active" : ""}
          onClick={() => setActiveTab("tasks")}
        >
          <span className="tab-icon">🔧</span>
          <span>Bauteile</span>
        </button>
        <button
          className={activeTab === "simulation" ? "active" : ""}
          onClick={() => setActiveTab("simulation")}
        >
          <span className="tab-icon">▶</span>
          <span>Abspielen</span>
        </button>
      </nav>

      <main>
        {activeTab === "tasks" && (
          <TaskList
            tasks={tasks}
            setTasks={setTasks}
            api={api}
            viewerState={{ ...viewerState, aktivesModellId }}
          />
        )}
        {activeTab === "simulation" && (
          <SimulationPlayer
            tasks={tasks}
            api={api}
            aktivesModellId={aktivesModellId}
          />
        )}
      </main>
    </div>
  );
}