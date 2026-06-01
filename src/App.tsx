import { useState } from "react";
import { useApi } from "./hooks/useApi";
import type { Task } from "./types";
import GanttImport from "./components/GanttImport";
import TaskList from "./components/TaskList";
import SimulationPlayer from "./components/SimulationPlayer";

const KEY = "4d-v6";
function load() { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch {} return null; }
function save(d: any) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} }

export default function App() {
  const { api, connected, isViewerContext, setIsViewerContext, viewerState, setViewerState } = useApi();
  const saved = load();

  const [tasks, setTasksRaw] = useState<Task[]>(saved?.tasks || []);
  const [modellIds, setModellIds] = useState<string[]>(saved?.modellIds || []);
  const [aktivTab, setAktivTab] = useState<"bauteile" | "simulation">("bauteile");
  const [zeigeGantt, setZeigeGantt] = useState(false);

  const hatProjekt = tasks.length > 0;
  const ersteltAm = saved?.ersteltAm || "";
  const aktivModellId = modellIds[0] || viewerState.aktivesModellId;

  function setTasks(t: Task[]) {
    setTasksRaw(t);
    save({ tasks: t, modellIds, ersteltAm: ersteltAm || new Date().toLocaleDateString("de-CH") });
  }

  function ganttAktualisieren(neueTasks: Task[]) {
    const merged = neueTasks.map(neu => {
      const alt = tasks.find(t => t.name.toLowerCase() === neu.name.toLowerCase());
      return alt ? { ...neu, typ: alt.typ, objektGuids: alt.objektGuids } : neu;
    });
    setTasks(merged);
  }

  function ganttLaden(neueTasks: Task[]) {
    save({ tasks: neueTasks, modellIds: [viewerState.aktivesModellId], ersteltAm: new Date().toLocaleDateString("de-CH") });
    setTasksRaw(neueTasks);
    setModellIds([viewerState.aktivesModellId]);
    setViewerState(prev => ({ ...prev }));
    setZeigeGantt(false);
  }

  function simulationLoeschen() {
    if (confirm("Simulation und alle Verknüpfungen löschen?")) {
      localStorage.removeItem(KEY);
      setTasksRaw([]); setModellIds([]);
    }
  }

  const Header = () => (
    <div className="tc-header">
      <div className="tc-header-left">
        <div className="tc-logo">4D</div>
        <span className="tc-header-title">4D Bauablauf</span>
      </div>
      <div className="tc-header-right">
        {hatProjekt && <span className="tc-task-badge">{tasks.length} Tasks</span>}
        <span className={`tc-dot ${connected ? "on" : "off"}`} />
        <button
          title={isViewerContext ? "Projektbereich" : "3D Viewer"}
          style={{ background: "rgba(255,255,255,.15)", border: "none", color: "white", padding: "2px 6px", borderRadius: 3, fontSize: 10, cursor: "pointer", marginLeft: 4 }}
          onClick={() => setIsViewerContext(!isViewerContext)}>
          {isViewerContext ? "📋" : "🏗️"}
        </button>
      </div>
    </div>
  );

  // ── 3D VIEWER ─────────────────────────────────────────
  if (isViewerContext) {
    // Gantt Import Overlay
    if (zeigeGantt) {
      return (
        <div className="app viewer-app">
          <div className="tc-header">
            <div className="tc-header-left">
              <button className="tc-back-btn" onClick={() => setZeigeGantt(false)}>←</button>
              <span className="tc-header-title">Gantt importieren</span>
            </div>
            <span className={`tc-dot ${connected ? "on" : "off"}`} />
          </div>
          <div className="tc-setup-content">
            <GanttImport tasks={tasks} setTasks={ganttLaden} ganttAktualisieren={ganttAktualisieren} />
          </div>
        </div>
      );
    }

    // Kein Projekt: Neue Simulation direkt im Viewer starten
    if (!hatProjekt) {
      return (
        <div className="app viewer-app">
          <Header />
          <div className="tc-empty">
            <div className="tc-empty-icon">📊</div>
            <div className="tc-empty-title">Neue Simulation</div>
            <div className="tc-empty-sub" style={{ marginBottom: 16 }}>
              Importiere einen Gantt um zu starten.
            </div>
            <button className="tc-btn-primary" style={{ padding: "10px 20px", fontSize: 13 }}
              onClick={() => setZeigeGantt(true)}>
              📂 Gantt importieren
            </button>
          </div>
        </div>
      );
    }

    // Hauptansicht mit Tabs
    return (
      <div className="app viewer-app">
        <Header />
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
              viewerState={{ ...viewerState, aktivesModellId: aktivModellId }} />
          )}
          {aktivTab === "simulation" && (
            <SimulationPlayer tasks={tasks} api={api} aktivesModellId={aktivModellId} />
          )}
        </div>
      </div>
    );
  }

  // ── PROJEKTPANEL (vereinfacht) ─────────────────────────
  return (
    <div className="app setup-app">
      <Header />
      <div className="tc-setup-content">
        <div className="tc-section-label">Simulationen</div>

        {!hatProjekt && (
          <div className="tc-empty" style={{ padding: "24px 0" }}>
            <div className="tc-empty-icon">⚙️</div>
            <div className="tc-empty-title">Noch kein Projekt</div>
            <div className="tc-empty-sub">
              Öffne den <strong>3D Viewer</strong> und importiere dort deinen Gantt.
            </div>
          </div>
        )}

        {hatProjekt && (
          <>
            <div className="tc-projekt-card">
              <div className="tc-pk-header">
                <span className="tc-pk-icon">📊</span>
                <div className="tc-pk-info">
                  <div className="tc-pk-name">4D Bauablaufsimulation</div>
                  <div className="tc-pk-meta">{ersteltAm && `Erstellt ${ersteltAm}`}</div>
                </div>
              </div>
              <div className="tc-pk-stats">
                <div className="tc-stat"><div className="tc-stat-n">{tasks.length}</div><div className="tc-stat-l">Tasks</div></div>
                <div className="tc-stat"><div className="tc-stat-n">{tasks.filter(t => t.objektGuids.length > 0).length}</div><div className="tc-stat-l">Verknüpft</div></div>
                <div className="tc-stat"><div className="tc-stat-n">{tasks.reduce((s, t) => s + t.objektGuids.length, 0)}</div><div className="tc-stat-l">Bauteile</div></div>
              </div>
              <div className="tc-pk-tasks">
                <div className="tc-pk-tasks-title">Tasks</div>
                {tasks.slice(0, 6).map(t => (
                  <div key={t.id} className="tc-pk-task-row">
                    <span className={`tc-pk-dot ${t.typ}`} />
                    <span className="tc-pk-task-name">{t.name}</span>
                    <span className="tc-pk-task-date">{t.start}</span>
                    <span className="tc-pk-task-count">{t.objektGuids.length > 0 ? `⬡ ${t.objektGuids.length}` : "∅"}</span>
                  </div>
                ))}
                {tasks.length > 6 && <div className="tc-pk-more">+ {tasks.length - 6} weitere</div>}
              </div>
              <div className="tc-pk-footer">
                <button className="tc-btn-secondary" onClick={() => setZeigeGantt(true)}>↻ Gantt aktualisieren</button>
                <button className="tc-btn-danger" onClick={simulationLoeschen}>🗑</button>
              </div>
            </div>

            {zeigeGantt && (
              <div style={{ marginTop: 10 }}>
                <GanttImport tasks={tasks} setTasks={setTasks} ganttAktualisieren={ganttAktualisieren} />
                <button className="tc-btn-ghost" style={{ width: "100%", marginTop: 8 }}
                  onClick={() => setZeigeGantt(false)}>Schliessen</button>
              </div>
            )}

            <div className="tc-hint" style={{ marginTop: 10 }}>
              <span className="tc-hint-icon">💡</span>
              <div>
                <div className="tc-hint-title">Bauteile im 3D Viewer zuweisen</div>
                <div className="tc-hint-desc">Öffne den 3D Viewer und aktiviere die Extension.</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}