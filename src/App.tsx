import { useState } from "react";
import { useApi } from "./hooks/useApi";
import type { Task } from "./types";
import FileBrowser from "./components/FileBrowser";
import GanttImport from "./components/GanttImport";
import TaskList from "./components/TaskList";
import SimulationPlayer from "./components/SimulationPlayer";

type SetupStep = "modelle" | "gantt";

const STORAGE_KEY = "4d-projekt-v4";

function ladeProjekt() {
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
  const { api, connected, isViewerContext, accessToken, projectId, viewerState, setViewerState } = useApi();
  const gespeichert = ladeProjekt();

  const [setupStep, setSetupStep] = useState<SetupStep>("modelle");
  const [tasks, setTasksRaw] = useState<Task[]>(gespeichert.tasks || []);
  const [ausgewaehlteModellIds, setAusgewaehlteModellIds] = useState<string[]>(gespeichert.modellIds || []);
  const [aktivesModellId, setAktivesModellId] = useState<string>(gespeichert.modellIds?.[0] || "");
  const [activeTab, setActiveTab] = useState<"tasks" | "simulation">("tasks");
  const [projektErstellt, setProjektErstellt] = useState(gespeichert.tasks?.length > 0);

  function setTasks(t: Task[]) {
    setTasksRaw(t);
    speichereProjekt(t, ausgewaehlteModellIds);
  }

  function ganttAktualisieren(neueTasks: Task[]) {
    const merged = neueTasks.map(neu => {
      const alt = tasks.find(t => t.name.toLowerCase() === neu.name.toLowerCase());
      return alt ? { ...neu, typ: alt.typ, objektGuids: alt.objektGuids } : neu;
    });
    setTasks(merged);
  }

  function simulationErstellen() {
    speichereProjekt(tasks, ausgewaehlteModellIds);
    setProjektErstellt(true);
    setAktivesModellId(ausgewaehlteModellIds[0] || "");
    setViewerState(prev => ({ ...prev, aktivesModellId: ausgewaehlteModellIds[0] || "" }));
  }

  function simulationNeu() {
    if (confirm("Neue Simulation starten? Alle Verknüpfungen werden gelöscht.")) {
      setTasksRaw([]);
      setAusgewaehlteModellIds([]);
      setProjektErstellt(false);
      setSetupStep("modelle");
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const Header = ({ showNeu = false }: { showNeu?: boolean }) => (
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
      {showNeu && (
        <button
          style={{ background: "rgba(255,255,255,0.2)", color: "white", padding: "2px 8px", fontSize: 10 }}
          onClick={simulationNeu}
        >⟳ Neue Simulation</button>
      )}
    </header>
  );

  // ── VIEWER CONTEXT: Arbeit ──────────────────────────────
  if (isViewerContext) {
    if (!projektErstellt) {
      return (
        <div className="app">
          <Header />
          <main>
            <div className="panel">
              <div className="empty-state">
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚙️</div>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Kein Projekt aktiv</p>
                <p>Erstelle zuerst eine Simulation im Projektbereich (4D Bauablauf → Daten).</p>
              </div>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="app">
        <Header showNeu={true} />
        <nav>
          <button className={activeTab === "tasks" ? "active" : ""} onClick={() => setActiveTab("tasks")}>
            <span className="tab-icon">🔧</span><span>Bauteile</span>
          </button>
          <button className={activeTab === "simulation" ? "active" : ""} onClick={() => setActiveTab("simulation")}>
            <span className="tab-icon">▶</span><span>Abspielen</span>
          </button>
        </nav>
        <main>
          {activeTab === "tasks" && (
            <TaskList
              tasks={tasks}
              setTasks={setTasks}
              api={api}
              viewerState={{ ...viewerState, aktivesModellId: aktivesModellId || viewerState.aktivesModellId }}
            />
          )}
          {activeTab === "simulation" && (
            <SimulationPlayer
              tasks={tasks}
              api={api}
              aktivesModellId={aktivesModellId || viewerState.aktivesModellId}
            />
          )}
        </main>
      </div>
    );
  }

  // ── PROJEKT CONTEXT: Setup ──────────────────────────────
  if (projektErstellt) {
    return (
      <div className="app">
        <Header showNeu={true} />
        <main>
          <div className="panel">
            <div className="alert success">
              ✓ Simulation aktiv · {tasks.length} Tasks · {ausgewaehlteModellIds.length} Modell(e)
            </div>
            <div className="info-box">
              Gehe zum <strong>3D Viewer</strong> um Bauteile zuzuweisen und die Simulation abzuspielen.
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn-primary" onClick={() => window.open(
                `${window.location.origin}/projects/${projectId}/viewer/3d`, "_blank"
              )}>
                → Zum 3D Viewer
              </button>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="section-header"><span>Gantt aktualisieren</span></div>
              <GanttImport tasks={tasks} setTasks={setTasks} ganttAktualisieren={ganttAktualisieren} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />

      <div className="setup-progress">
        <div className={`setup-step ${setupStep === "modelle" ? "aktiv" : "done"}`}>
          <span className="step-num">{setupStep === "modelle" ? "1" : "✓"}</span>
          <span>Modelle wählen</span>
        </div>
        <div className="step-line" />
        <div className={`setup-step ${setupStep === "gantt" ? "aktiv" : ""}`}>
          <span className="step-num">2</span>
          <span>Gantt laden</span>
        </div>
      </div>

      <main>
        {setupStep === "modelle" && (
          <div className="panel">
            <div className="section-header"><span>IFC-Modelle aus Ablage wählen</span></div>
            <div className="info-box">
              Wähle die IFC-Modelle für diese Simulation aus der Projektablage.
            </div>

            {!accessToken && (
              <div className="alert warn">⟳ Lade Zugriffsberechtigungen...</div>
            )}

            {accessToken && (
              <FileBrowser
                accessToken={accessToken}
                projectId={projectId}
                ausgewaehlteIds={ausgewaehlteModellIds}
                setAusgewaehlteIds={setAusgewaehlteModellIds}
              />
            )}

            <div style={{ marginTop: 12 }}>
              <button
                className="btn-primary"
                disabled={ausgewaehlteModellIds.length === 0}
                onClick={() => setSetupStep("gantt")}
              >
                Weiter → Gantt laden ({ausgewaehlteModellIds.length} gewählt)
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

            <GanttImport tasks={tasks} setTasks={setTasks} ganttAktualisieren={ganttAktualisieren} />

            <div style={{ marginTop: 12 }}>
              <button
                className="btn-start"
                disabled={tasks.length === 0}
                onClick={simulationErstellen}
              >
                ▶ Simulation erstellen
              </button>
              {tasks.length === 0 && (
                <p className="hinweis" style={{ marginTop: 6, textAlign: "center" }}>
                  Bitte zuerst Gantt-Datei laden.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}