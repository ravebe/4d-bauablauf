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
function ladeAktivId(): string { return localStorage.getItem(AKTIV_KEY) || ""; }
function speichereAktivId(id: string) { localStorage.setItem(AKTIV_KEY, id); }

export default function App() {
const { api, connected, isViewerContext, projectId, viewerState } = useApi();
  const [simulationen, setSimulationenRaw] = useState<SimProjekt[]>(ladeSims);
  const [aktivId, setAktivIdRaw] = useState<string>(ladeAktivId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [neueSimAktiv, setNeueSimAktiv] = useState(false);
  const [neueTasks, setNeueTasks] = useState<Task[]>([]);
  const [aktivTab, setAktivTab] = useState<"bauteile" | "simulation">("bauteile");
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null);
  const [umbenennenText, setUmbenennenText] = useState("");

  function setSimulationen(sims: SimProjekt[]) { setSimulationenRaw(sims); speichereSims(sims); }
  function setAktivId(id: string) { setAktivIdRaw(id); speichereAktivId(id); }

  function umbenennenStart(sim: SimProjekt, e: React.MouseEvent) {
    e.stopPropagation();
    setUmbenennenId(sim.id);
    setUmbenennenText(sim.name);
  }

  function umbenennenSpeichern() {
    if (!umbenennenId || !umbenennenText.trim()) { setUmbenennenId(null); return; }
    setSimulationen(simulationen.map(s => s.id === umbenennenId ? { ...s, name: umbenennenText.trim() } : s));
    setUmbenennenId(null);
  }

  function neueSimSpeichern(tasks: Task[]) {
    const id = Date.now().toString();
    const sim: SimProjekt = {
      id, name: `Simulation ${simulationen.length + 1}`,
      ersteltAm: new Date().toLocaleDateString("de-CH"), tasks,
    };
    const neu = [...simulationen, sim];
    setSimulationen(neu);
    setAktivId(id);
    setNeueTasks([]);
    setNeueSimAktiv(false);
    setExpandedId(id);
  }

  function simLoeschen(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Simulation löschen?")) return;
    const neu = simulationen.filter(s => s.id !== id);
    setSimulationen(neu);
    if (aktivId === id) setAktivId(neu.length > 0 ? neu[0].id : "");
    if (expandedId === id) setExpandedId(null);
  }

  function simBearbeiten(sim: SimProjekt) {
    setAktivId(sim.id);
    speichereSims(simulationen);
    // Flag setzen damit Viewer-Tab weiss er soll Viewer-UI zeigen
    localStorage.setItem("4d-viewer-mode", "true");
    const url = `https://web.connect.trimble.com/projects/${projectId}/viewer/3d`;
    window.open(url, "_blank");
  }

  function ganttAktualisieren(simId: string, t: Task[]) {
    const aktuell = simulationen.find(s => s.id === simId);
    if (!aktuell) return;
    const merged = t.map(neu => {
      const alt = aktuell.tasks.find(x => x.name.toLowerCase() === neu.name.toLowerCase());
      return alt ? { ...neu, typ: alt.typ, objektGuids: alt.objektGuids } : neu;
    });
    setSimulationen(simulationen.map(s => s.id === simId ? { ...s, tasks: merged } : s));
  }

  const aktivSim = simulationen.find(s => s.id === aktivId) || simulationen[0];

  // ════════════════════════════════════════════════════════
  // 3D VIEWER – komplett eigenes Tool
  // ════════════════════════════════════════════════════════
  if (isViewerContext) {
    const tasks = aktivSim?.tasks || [];

    function setTasks(t: Task[]) {
      if (!aktivSim) return;
      const neu = simulationen.map(s => s.id === aktivSim.id ? { ...s, tasks: t } : s);
      setSimulationenRaw(neu);
      speichereSims(neu);
    }

    return (
      <div className="app viewer-app">
        {/* Viewer Header */}
        <div className="tc-header">
          <div className="tc-header-left">
            <div className="tc-logo">4D</div>
            <div>
              <div className="tc-header-title">{aktivSim?.name || "4D Bauablauf"}</div>
            </div>
          </div>
          <div className="tc-header-right">
            {tasks.length > 0 && <span className="tc-task-badge">{tasks.length} Tasks</span>}
            <span className={`tc-dot ${connected ? "on" : "off"}`} />
          </div>
        </div>

        {/* Kein Projekt */}
        {!aktivSim || tasks.length === 0 ? (
          <div className="tc-empty">
            <div className="tc-empty-icon">📊</div>
            <div className="tc-empty-title">Kein Projekt aktiv</div>
            <div className="tc-empty-sub">
              Erstelle eine Simulation im Projektbereich<br />und klicke "Bearbeiten im 3D Viewer".
            </div>
          </div>
        ) : (
          <>
            {/* Viewer Tabs */}
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
                <TaskList tasks={tasks} setTasks={setTasks} api={api} viewerState={viewerState} />
              )}
              {aktivTab === "simulation" && (
                <SimulationPlayer tasks={tasks} api={api} aktivesModellId={viewerState.aktivesModellId} />
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // PROJEKTPANEL – komplett eigenes Tool, kein Toggle-Button
  // ════════════════════════════════════════════════════════
  return (
    <div className="app setup-app">
      {/* Panel Header – KEIN Toggle-Button */}
      <div className="tc-header">
        <div className="tc-header-left">
          <div className="tc-logo">4D</div>
          <span className="tc-header-title">4D Bauablauf</span>
        </div>
        <div className="tc-header-right">
          <span className={`tc-dot ${connected ? "on" : "off"}`} />
        </div>
      </div>

      <div className="tc-setup-content">
        {/* Titel + Neu-Button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="tc-section-label" style={{ marginBottom: 0 }}>Simulationen</div>
          <button
            className="tc-btn-primary"
            style={{ padding: "6px 16px", fontSize: 12 }}
            onClick={() => { setNeueSimAktiv(true); setNeueTasks([]); }}>
            + Neu
          </button>
        </div>

        {/* Neue Simulation */}
        {neueSimAktiv && (
          <div style={{ border: "1.5px solid var(--tc-blue)", borderRadius: 8, overflow: "hidden", marginBottom: 12, background: "var(--tc-white)" }}>
            <div style={{ padding: "10px 14px", background: "var(--tc-blue-light)", borderBottom: "1px solid var(--tc-blue-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tc-blue)" }}>Neue Simulation</span>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tc-text-3)", fontSize: 16 }}
                onClick={() => setNeueSimAktiv(false)}>✕</button>
            </div>
            <div style={{ padding: 14 }}>
              <GanttImport
                tasks={neueTasks}
                setTasks={setNeueTasks}
                ganttAktualisieren={t => setNeueTasks(t)}
                onNachImport={t => setNeueTasks(t)}
              />
              {neueTasks.length > 0 && (
                <>
                  <GanttTabelle tasks={neueTasks} />
                  <button
                    className="tc-btn-primary"
                    style={{ width: "100%", marginTop: 10, padding: "9px 0", fontSize: 13 }}
                    onClick={() => neueSimSpeichern(neueTasks)}>
                    ✓ Simulation erstellen
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Leerer Zustand */}
        {simulationen.length === 0 && !neueSimAktiv && (
          <div className="tc-empty" style={{ padding: "32px 0" }}>
            <div className="tc-empty-icon">📊</div>
            <div className="tc-empty-title">Noch keine Simulationen</div>
            <div className="tc-empty-sub">Klicke "+ Neu" um zu starten.</div>
          </div>
        )}

        {/* Simulations-Liste */}
        {simulationen.map(sim => (
          <div key={sim.id} style={{
            border: `1px solid ${sim.id === aktivId ? "var(--tc-blue)" : "var(--tc-border)"}`,
            borderRadius: 8, overflow: "hidden", marginBottom: 8,
            background: "var(--tc-white)", boxShadow: "var(--tc-shadow)"
          }}>
            {/* Sim Header */}
            <div
              style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => setExpandedId(expandedId === sim.id ? null : sim.id)}>
              <span style={{ fontSize: 22 }}>📊</span>
              <div style={{ flex: 1 }}>
                {umbenennenId === sim.id ? (
                  <input
                    autoFocus
                    value={umbenennenText}
                    onChange={e => setUmbenennenText(e.target.value)}
                    onBlur={umbenennenSpeichern}
                    onKeyDown={e => { if (e.key === "Enter") umbenennenSpeichern(); if (e.key === "Escape") setUmbenennenId(null); }}
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 13, fontWeight: 600, border: "1px solid var(--tc-blue)", borderRadius: 4, padding: "2px 6px", width: "90%", fontFamily: "inherit", color: "var(--tc-text)" }}
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tc-text)" }}>{sim.name}</span>
                    <button onClick={e => umbenennenStart(sim, e)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--tc-text-3)", padding: "1px 4px" }}
                      title="Umbenennen">✏️</button>
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--tc-text-3)" }}>
                  {sim.ersteltAm} · {sim.tasks.length} Tasks
                </div>
              </div>
              {sim.id === aktivId && (
                <span style={{ fontSize: 10, background: "var(--tc-blue-light)", color: "var(--tc-blue)", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>Aktiv</span>
              )}
              <span style={{ fontSize: 11, color: "var(--tc-text-3)" }}>{expandedId === sim.id ? "▲" : "▼"}</span>
            </div>

            {/* Sim Detail */}
            {expandedId === sim.id && (
              <div style={{ borderTop: "1px solid var(--tc-border)", padding: 14 }}>
                <GanttTabelle tasks={sim.tasks} />
                <div style={{ marginTop: 10, marginBottom: 10 }}>
                  <GanttImport
                    tasks={sim.tasks}
                    setTasks={t => setSimulationen(simulationen.map(s => s.id === sim.id ? { ...s, tasks: t } : s))}
                    ganttAktualisieren={t => ganttAktualisieren(sim.id, t)}
                    onNachImport={t => ganttAktualisieren(sim.id, t)}
                    kompakt={true}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="tc-btn-primary"
                    style={{ flex: 1, padding: "9px 0", fontSize: 13 }}
                    onClick={() => simBearbeiten(sim)}>
                    ✏️ Bearbeiten im 3D Viewer
                  </button>
                  <button
                    className="tc-btn-danger"
                    style={{ padding: "9px 12px" }}
                    onClick={e => simLoeschen(sim.id, e)}>🗑</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}