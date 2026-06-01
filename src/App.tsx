import { useState } from "react";
import { useApi } from "./hooks/useApi";
import type { Task } from "./types";
import GanttTabelle from "./components/GanttTabelle.tsx";
import GanttImport from "./components/GanttImport";
import TaskList from "./components/TaskList";
import SimulationPlayer from "./components/SimulationPlayer";

const SIMS_KEY = "4d-sims-v2";
const AKTIV_KEY = "4d-aktiv-v2";

interface SimProjekt {
  id: string;
  name: string;
  ersteltAm: string;
  tasks: Task[];
}

function ladeSims(): SimProjekt[] {
  try { const r = localStorage.getItem(SIMS_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function speichereSims(sims: SimProjekt[]) {
  try { localStorage.setItem(SIMS_KEY, JSON.stringify(sims)); } catch {}
}
function ladeAktivId(): string {
  return localStorage.getItem(AKTIV_KEY) || "";
}
function speichereAktivId(id: string) {
  localStorage.setItem(AKTIV_KEY, id);
}

export default function App() {
  const { api, connected, isViewerContext, setIsViewerContext, projectId, viewerState } = useApi();

  const [simulationen, setSimulationenRaw] = useState<SimProjekt[]>(ladeSims);
  const [aktivId, setAktivIdRaw] = useState<string>(ladeAktivId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [neueSimAktiv, setNeueSimAktiv] = useState(false);
  const [neueTasks, setNeueTasks] = useState<Task[]>([]);
  const [aktivTab, setAktivTab] = useState<"bauteile" | "simulation">("bauteile");

  function setSimulationen(sims: SimProjekt[]) {
    setSimulationenRaw(sims);
    speichereSims(sims);
  }

  function setAktivId(id: string) {
    setAktivIdRaw(id);
    speichereAktivId(id);
  }

  function neueSimErstellen() {
    setNeueSimAktiv(true);
    setNeueTasks([]);
  }

  function neueSimSpeichern(tasks: Task[]) {
    const id = Date.now().toString();
    const sim: SimProjekt = {
      id,
      name: `Simulation ${simulationen.length + 1}`,
      ersteltAm: new Date().toLocaleDateString("de-CH"),
      tasks,
    };
    const neu = [...simulationen, sim];
    setSimulationen(neu);
    setNeueTasks(tasks);
    setNeueSimAktiv(false);
    setExpandedId(id);
  }

  function simLoeschen(id: string) {
    if (!confirm("Simulation löschen?")) return;
    const neu = simulationen.filter(s => s.id !== id);
    setSimulationen(neu);
    if (aktivId === id) setAktivId(neu.length > 0 ? neu[0].id : "");
    if (expandedId === id) setExpandedId(null);
  }

  function simImViewer(sim: SimProjekt) {
    setAktivId(sim.id);
    speichereSims(simulationen);
    const url = `https://web.connect.trimble.com/projects/${projectId}/viewer/3d`;
    window.open(url, "_blank");
  }

  function ganttAktualisieren(simId: string, neueTasks: Task[]) {
    const aktuell = simulationen.find(s => s.id === simId);
    if (!aktuell) return;
    const merged = neueTasks.map(neu => {
      const alt = aktuell.tasks.find(t => t.name.toLowerCase() === neu.name.toLowerCase());
      return alt ? { ...neu, typ: alt.typ, objektGuids: alt.objektGuids } : neu;
    });
    const neu = simulationen.map(s => s.id === simId ? { ...s, tasks: merged } : s);
    setSimulationen(neu);
  }

  const aktivSim = simulationen.find(s => s.id === aktivId) || simulationen[0];

  // ── VIEWER ─────────────────────────────────────────────
  if (isViewerContext) {
    const tasks = aktivSim?.tasks || [];
    const setTasks = (t: Task[]) => {
      if (!aktivSim) return;
      const neu = simulationen.map(s => s.id === aktivSim.id ? { ...s, tasks: t } : s);
      setSimulationen(neu);
    };

    return (
      <div className="app viewer-app">
        <div className="tc-header">
          <div className="tc-header-left">
            <div className="tc-logo">4D</div>
            <span className="tc-header-title">{aktivSim?.name || "4D Bauablauf"}</span>
          </div>
          <div className="tc-header-right">
            {tasks.length > 0 && <span className="tc-task-badge">{tasks.length} Tasks</span>}
            <span className={`tc-dot ${connected ? "on" : "off"}`} />
            <button
              style={{ background: "rgba(255,255,255,.15)", border: "none", color: "white", padding: "2px 6px", borderRadius: 3, fontSize: 10, cursor: "pointer", marginLeft: 4 }}
              onClick={() => setIsViewerContext(false)}>📋</button>
          </div>
        </div>

        {!aktivSim || tasks.length === 0 ? (
          <div className="tc-empty">
            <div className="tc-empty-icon">📊</div>
            <div className="tc-empty-title">Kein Projekt aktiv</div>
            <div className="tc-empty-sub">Erstelle eine Simulation im Projektbereich.</div>
          </div>
        ) : (
          <>
            <div className="tc-tabs">
              <button className={aktivTab === "bauteile" ? "active" : ""} onClick={() => setAktivTab("bauteile")}>
                <span>🔧</span> Bauteile
              </button>
              <button className={aktivTab === "simulation" ? "active" : ""} onClick={() => setAktivTab("simulation")}>
                <span>▶</span> Abspielen
              </button>
            </div>
            <div className="tc-tab-content">
              {aktivTab === "bauteile" && (
                <TaskList tasks={tasks} setTasks={setTasks} api={api}
                  viewerState={{ ...viewerState, aktivesModellId: viewerState.aktivesModellId }} />
              )}
              {aktivTab === "simulation" && (
                <SimulationPlayer tasks={tasks} api={api}
                  aktivesModellId={viewerState.aktivesModellId} />
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── PROJEKTPANEL ────────────────────────────────────────
  return (
    <div className="app setup-app">
      <div className="tc-header">
        <div className="tc-header-left">
          <div className="tc-logo">4D</div>
          <span className="tc-header-title">4D Bauablauf</span>
        </div>
        <div className="tc-header-right">
          <span className={`tc-dot ${connected ? "on" : "off"}`} />
          <button style={{ background: "rgba(255,255,255,.15)", border: "none", color: "white", padding: "2px 6px", borderRadius: 3, fontSize: 10, cursor: "pointer", marginLeft: 4 }}
            onClick={() => setIsViewerContext(true)}>🏗️</button>
        </div>
      </div>

      <div className="tc-setup-content">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="tc-section-label" style={{ marginBottom: 0 }}>Simulationen</div>
          <button className="tc-btn-primary" style={{ padding: "6px 16px", fontSize: 12 }}
            onClick={neueSimErstellen}>
            + Neu
          </button>
        </div>

        {/* Neue Simulation erstellen */}
        {neueSimAktiv && (
          <div style={{ border: "1.5px solid var(--tc-blue)", borderRadius: 8, overflow: "hidden", marginBottom: 12, background: "var(--tc-white)" }}>
            <div style={{ padding: "10px 14px", background: "var(--tc-blue-light)", borderBottom: "1px solid var(--tc-blue-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tc-blue)" }}>Neue Simulation</span>
              <button style={{ background: "none", border: "none", color: "var(--tc-text-3)", cursor: "pointer", fontSize: 14 }}
                onClick={() => setNeueSimAktiv(false)}>✕</button>
            </div>
            <div style={{ padding: 14 }}>
              <GanttImport
                tasks={neueTasks}
                setTasks={setNeueTasks}
                ganttAktualisieren={(t) => setNeueTasks(t)}
                onNachImport={(t) => setNeueTasks(t)}
              />
              {neueTasks.length > 0 && (
                <>
                  <GanttTabelle tasks={neueTasks} />
                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    <button className="tc-btn-primary" style={{ flex: 1, padding: "9px 0", fontSize: 13 }}
                      onClick={() => neueSimSpeichern(neueTasks)}>
                      ✓ Simulation erstellen
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Liste bestehender Simulationen */}
        {simulationen.length === 0 && !neueSimAktiv && (
          <div className="tc-empty" style={{ padding: "32px 0" }}>
            <div className="tc-empty-icon">📊</div>
            <div className="tc-empty-title">Noch keine Simulationen</div>
            <div className="tc-empty-sub">Klicke "+ Neu" um zu starten.</div>
          </div>
        )}

        {simulationen.map(sim => (
          <div key={sim.id} style={{
            border: `1px solid ${sim.id === aktivId ? "var(--tc-blue)" : "var(--tc-border)"}`,
            borderRadius: 8, overflow: "hidden", marginBottom: 8,
            background: "var(--tc-white)", boxShadow: "var(--tc-shadow)"
          }}>
            {/* Sim Header */}
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => setExpandedId(expandedId === sim.id ? null : sim.id)}>
              <span style={{ fontSize: 22 }}>📊</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tc-text)" }}>{sim.name}</div>
                <div style={{ fontSize: 11, color: "var(--tc-text-3)" }}>
                  {sim.ersteltAm} · {sim.tasks.length} Tasks
                </div>
              </div>
              {sim.id === aktivId && (
                <span style={{ fontSize: 10, background: "var(--tc-blue-light)", color: "var(--tc-blue)", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>Aktiv</span>
              )}
              <span style={{ fontSize: 11, color: "var(--tc-text-3)" }}>
                {expandedId === sim.id ? "▲" : "▼"}
              </span>
            </div>

            {/* Sim Detail */}
            {expandedId === sim.id && (
              <div style={{ borderTop: "1px solid var(--tc-border)", padding: 14 }}>
                <GanttTabelle tasks={sim.tasks} />

                {/* Gantt aktualisieren */}
                <div style={{ marginTop: 10, marginBottom: 10 }}>
                  <GanttImport
                    tasks={sim.tasks}
                    setTasks={(t) => { const neu = simulationen.map(s => s.id === sim.id ? { ...s, tasks: t } : s); setSimulationen(neu); }}
                    ganttAktualisieren={(t) => ganttAktualisieren(sim.id, t)}
                    onNachImport={(t) => ganttAktualisieren(sim.id, t)}
                    kompakt={true}
                  />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tc-btn-primary" style={{ flex: 1, padding: "9px 0", fontSize: 13 }}
                    onClick={() => simImViewer(sim)}>
                    🏗️ Im 3D Viewer öffnen
                  </button>
                  <button className="tc-btn-danger" style={{ padding: "9px 12px" }}
                    onClick={() => simLoeschen(sim.id)}>🗑</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}