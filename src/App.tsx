import { useState } from "react";
import { useApi } from "./hooks/useApi";
import type { Task } from "./types";
import GanttTabelle from "./components/GanttTabelle.tsx";
import GanttImport from "./components/GanttImport";
import ModellVerwaltung from "./components/ModellVerwaltung";
import TaskList from "./components/TaskList";
import SimulationPlayer from "./components/SimulationPlayer";

const SIMS_KEY = "4d-sims-v2";
const AKTIV_KEY = "4d-aktiv-v2";

export interface ModellInfo {
  fileId: string;
  name: string;
  versionId?: string;
  neueVersion?: boolean;
}

export interface SimProjekt {
  id: string;
  name: string;
  ersteltAm: string;
  tasks: Task[];
  modelle: ModellInfo[];
}

function ladeSims(): SimProjekt[] {
  try { const r = localStorage.getItem(SIMS_KEY); if (r) return JSON.parse(r); } catch {}
  return [];
}
function speichereSims(s: SimProjekt[]) { try { localStorage.setItem(SIMS_KEY, JSON.stringify(s)); } catch {} }
function ladeAktivId(): string { return localStorage.getItem(AKTIV_KEY) || ""; }
function speichereAktivId(id: string) { localStorage.setItem(AKTIV_KEY, id); }

export default function App() {
  const { api, connected, isViewerContext, setIsViewerContext, detecting, accessToken, projectId, viewerState } = useApi();

  const [simulationen, setSimulationenRaw] = useState<SimProjekt[]>(ladeSims);
  const [aktivId, setAktivIdRaw] = useState<string>(ladeAktivId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [neueSimAktiv, setNeueSimAktiv] = useState(false);
  const [neueTasks, setNeueTasks] = useState<Task[]>([]);
  const [neueModelle, setNeueModelle] = useState<ModellInfo[]>([]);
  const [aktivTab, setAktivTab] = useState<"bauteile" | "simulation">("bauteile");
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null);
  const [umbenennenText, setUmbenennenText] = useState("");

  function setSimulationen(sims: SimProjekt[]) { setSimulationenRaw(sims); speichereSims(sims); }
  function setAktivId(id: string) { setAktivIdRaw(id); speichereAktivId(id); }

  function updateSim(id: string, changes: Partial<SimProjekt>) {
    setSimulationen(simulationen.map(s => s.id === id ? { ...s, ...changes } : s));
  }

  function umbenennenStart(sim: SimProjekt, e: React.MouseEvent) {
    e.stopPropagation();
    setUmbenennenId(sim.id);
    setUmbenennenText(sim.name);
  }

  function umbenennenSpeichern() {
    if (!umbenennenId || !umbenennenText.trim()) { setUmbenennenId(null); return; }
    updateSim(umbenennenId, { name: umbenennenText.trim() });
    setUmbenennenId(null);
  }

  function neueSimSpeichern() {
    const id = Date.now().toString();
    const sim: SimProjekt = {
      id,
      name: `Simulation ${simulationen.length + 1}`,
      ersteltAm: new Date().toLocaleDateString("de-CH"),
      tasks: neueTasks,
      modelle: neueModelle,
    };
    const neu = [...simulationen, sim];
    setSimulationen(neu);
    setAktivId(id);
    setNeueTasks([]);
    setNeueModelle([]);
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
    const modelParam = sim.modelle?.length > 0
      ? `?modelId=${encodeURIComponent(sim.modelle[0].versionId || sim.modelle[0].fileId)}`
      : "";
    const url = `https://web.connect.trimble.com/projects/${projectId}/viewer/3d${modelParam}`;
    window.open(url, "_blank");
  }

  function ganttAktualisieren(simId: string, t: Task[]) {
    const aktuell = simulationen.find(s => s.id === simId);
    if (!aktuell) return;
    const merged = t.map(neu => {
      const alt = aktuell.tasks.find(x => x.name.toLowerCase() === neu.name.toLowerCase());
      return alt ? { ...neu, typ: alt.typ, objektGuids: alt.objektGuids } : neu;
    });
    updateSim(simId, { tasks: merged });
  }

  const aktivSim = simulationen.find(s => s.id === aktivId) || simulationen[0];

  // Ladescreen während Context-Erkennung
  if (detecting) {
    return (
      <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--tc-bg)" }}>
        <div style={{ textAlign: "center", color: "var(--tc-text-3)" }}>
          <div style={{ fontSize: 28, marginBottom: 8, animation: "spin 1s linear infinite" }}>⟳</div>
          <div style={{ fontSize: 12 }}>Verbinde...</div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // 3D VIEWER
  // ════════════════════════════════════════════════════════
  if (isViewerContext) {
    const tasks = aktivSim?.tasks || [];
    const modelle = aktivSim?.modelle || [];

    const setTasks = (t: Task[]) => {
      if (!aktivSim) return;
      const neu = simulationen.map(s => s.id === aktivSim.id ? { ...s, tasks: t } : s);
      setSimulationenRaw(neu);
      speichereSims(neu);
    };

    return (
      <div className="app viewer-app">
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

        {modelle.length > 0 && viewerState.modelle.length === 0 && (
          <div style={{ padding: "6px 12px", background: "#FFF4CE", borderBottom: "1px solid #FFD700", fontSize: 11, color: "#6B3A00" }}>
            ⚠ Verknüpfte Modelle: {modelle.map(m => m.name).join(", ")}
          </div>
        )}

        {!aktivSim || tasks.length === 0 ? (
          <div className="tc-empty">
            <div className="tc-empty-icon">📊</div>
            <div className="tc-empty-title">Kein Projekt aktiv</div>
            <div className="tc-empty-sub">
              Erstelle eine Simulation im Projektbereich<br />und klicke "Bearbeiten im 3D Viewer".
            </div>
            <button
              className="tc-btn-primary"
              style={{ marginTop: 16, padding: "8px 20px" }}
              onClick={() => setIsViewerContext(false)}>
              → Zum Projektbereich
            </button>
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
  // PROJEKTPANEL
  // ════════════════════════════════════════════════════════
  return (
    <div className="app setup-app">
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="tc-section-label" style={{ marginBottom: 0 }}>Simulationen</div>
          <button className="tc-btn-primary" style={{ padding: "6px 16px", fontSize: 12 }}
            onClick={() => { setNeueSimAktiv(true); setNeueTasks([]); setNeueModelle([]); }}>
            + Neu
          </button>
        </div>

        {neueSimAktiv && (
          <div style={{ border: "1.5px solid var(--tc-blue)", borderRadius: 8, overflow: "hidden", marginBottom: 12, background: "var(--tc-white)" }}>
            <div style={{ padding: "10px 14px", background: "var(--tc-blue-light)", borderBottom: "1px solid var(--tc-blue-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                  <ModellVerwaltung
                    modelle={neueModelle}
                    setModelle={setNeueModelle}
                    accessToken={accessToken}
                    projectId={projectId}
                  />
                  <button className="tc-btn-primary"
                    style={{ width: "100%", marginTop: 10, padding: "9px 0", fontSize: 13 }}
                    onClick={neueSimSpeichern}>
                    ✓ Simulation erstellen
                  </button>
                </>
              )}
            </div>
          </div>
        )}

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
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => setExpandedId(expandedId === sim.id ? null : sim.id)}>
              <span style={{ fontSize: 22 }}>📊</span>
              <div style={{ flex: 1 }}>
                {umbenennenId === sim.id ? (
                  <input autoFocus value={umbenennenText}
                    onChange={e => setUmbenennenText(e.target.value)}
                    onBlur={umbenennenSpeichern}
                    onKeyDown={e => { if (e.key === "Enter") umbenennenSpeichern(); if (e.key === "Escape") setUmbenennenId(null); }}
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 13, fontWeight: 600, border: "1px solid var(--tc-blue)", borderRadius: 4, padding: "2px 6px", width: "90%", fontFamily: "inherit", color: "var(--tc-text)" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--tc-text)" }}>{sim.name}</span>
                    <button onClick={e => umbenennenStart(sim, e)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--tc-text-3)", padding: "1px 4px" }}
                      title="Umbenennen">✏️</button>
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--tc-text-3)" }}>
                  {sim.ersteltAm} · {sim.tasks.length} Tasks · {sim.modelle?.length || 0} Modell(e)
                </div>
              </div>
              {sim.id === aktivId && (
                <span style={{ fontSize: 10, background: "var(--tc-blue-light)", color: "var(--tc-blue)", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>Aktiv</span>
              )}
              <span style={{ fontSize: 11, color: "var(--tc-text-3)" }}>{expandedId === sim.id ? "▲" : "▼"}</span>
            </div>

            {expandedId === sim.id && (
              <div style={{ borderTop: "1px solid var(--tc-border)", padding: 14 }}>
                <GanttTabelle tasks={sim.tasks} />
                <ModellVerwaltung
                  modelle={sim.modelle || []}
                  setModelle={m => updateSim(sim.id, { modelle: m })}
                  accessToken={accessToken}
                  projectId={projectId}
                />
                <div style={{ marginTop: 8, marginBottom: 10 }}>
                  <GanttImport
                    tasks={sim.tasks}
                    setTasks={t => updateSim(sim.id, { tasks: t })}
                    ganttAktualisieren={t => ganttAktualisieren(sim.id, t)}
                    onNachImport={t => ganttAktualisieren(sim.id, t)}
                    kompakt={true}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="tc-btn-primary"
                    style={{ flex: 1, padding: "9px 0", fontSize: 13 }}
                    onClick={() => simBearbeiten(sim)}>
                    ✏️ Bearbeiten im 3D Viewer
                  </button>
                  <button className="tc-btn-danger"
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