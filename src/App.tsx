import { useState } from "react";
import GanttImport from "./components/GanttImport";
import ModelSelector from "./components/ModelSelector";
import TaskList from "./components/TaskList";
import SimulationPlayer from "./components/SimulationPlayer";
import { useApi } from "./hooks/useApi";
import type { Task } from "./types";

const STORAGE_KEY = "4d-bauablauf-v2";

function ladeState(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function speichereState(tasks: Task[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
}

function App() {
  const { api, connected, viewerState, setViewerState } = useApi();
  const [tasks, setTasksRaw] = useState<Task[]>(ladeState);
  const [activeTab, setActiveTab] = useState<"gantt" | "modelle" | "tasks" | "simulation">("gantt");

  function setTasks(neueTasks: Task[]) {
    setTasksRaw(neueTasks);
    speichereState(neueTasks);
  }

  function ganttAktualisieren(neueTasks: Task[]) {
    const merged = neueTasks.map(neu => {
      const alt = tasks.find(t => t.name.toLowerCase() === neu.name.toLowerCase());
      return alt ? { ...neu, typ: alt.typ, objektGuids: alt.objektGuids, manuellefarbe: alt.manuellefarbe } : neu;
    });
    setTasks(merged);
  }

  function setAktivesModellId(id: string) {
    setViewerState(prev => ({ ...prev, aktivesModellId: id }));
  }

  const tabs = [
    { id: "gantt", label: "Gantt", icon: "📋" },
    { id: "modelle", label: "Modelle", icon: "🏗️" },
    { id: "tasks", label: "Bauteile", icon: "🔧" },
    { id: "simulation", label: "Abspielen", icon: "▶" },
  ] as const;

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
        <div className="task-count">{tasks.length} Tasks</div>
      </header>

      <nav>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <main>
        {activeTab === "gantt" && (
          <GanttImport tasks={tasks} setTasks={setTasks} ganttAktualisieren={ganttAktualisieren} />
        )}
        {activeTab === "modelle" && (
          <ModelSelector
            api={api}
            viewerState={viewerState}
            setAktivesModellId={setAktivesModellId}
          />
        )}
        {activeTab === "tasks" && (
          <TaskList
            tasks={tasks}
            setTasks={setTasks}
            api={api}
            viewerState={viewerState}
          />
        )}
        {activeTab === "simulation" && (
          <SimulationPlayer
            tasks={tasks}
            api={api}
            aktivesModellId={viewerState.aktivesModellId}
          />
        )}
      </main>
    </div>
  );
}

export default App;