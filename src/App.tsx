import { useState } from "react";
import GanttImport from "./components/GanttImport";
import ModelSelector from "./components/ModelSelector";
import TaskList from "./components/TaskList";
import SimulationPlayer from "./components/SimulationPlayer";
import { useApi } from "./hooks/useApi";
import type { Task } from "./types";
function App() {
  const { api, connected } = useApi();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<"gantt" | "modelle" | "tasks" | "simulation">("gantt");

  return (
    <div className="app">
      <header>
        <h1>4D Bauablauf</h1>
        {connected ? (
          <span className="badge connected">Verbunden</span>
        ) : (
          <span className="badge disconnected">Verbinde...</span>
        )}
      </header>

      <nav>
        {(["gantt", "modelle", "tasks", "simulation"] as const).map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "gantt" && "① Gantt"}
            {tab === "modelle" && "② Modelle"}
            {tab === "tasks" && "③ Bauteile"}
            {tab === "simulation" && "④ Simulation"}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === "gantt" && <GanttImport tasks={tasks} setTasks={setTasks} />}
        {activeTab === "modelle" && <ModelSelector api={api} />}
        {activeTab === "tasks" && <TaskList tasks={tasks} setTasks={setTasks} api={api} />}
        {activeTab === "simulation" && <SimulationPlayer tasks={tasks} api={api} />}
      </main>
    </div>
  );
}

export default App;