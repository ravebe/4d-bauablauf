import { useState } from "react";
import { useApi } from "./hooks/useApi";
import type { Task } from "./types";
import FileBrowser from "./components/FileBrowser";
import GanttImport from "./components/GanttImport";
import TaskList from "./components/TaskList";
import SimulationPlayer from "./components/SimulationPlayer";

type View = "home" | "neu-modelle" | "neu-gantt" | "work-tasks" | "work-sim";

const KEY = "4d-v5";

function load() {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch {}
  return null;
}

function save(data: any) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
}

export default function App() {
  const { api, connected, accessToken, projectId, viewerState, setViewerState, isViewerContext } = useApi();

  const saved = load();
  const [view, setView] = useState<View>(
    saved?.tasks?.length > 0
      ? (isViewerContext ? "work-tasks" : "home")
      : "home"
  );
  const [tasks, setTasksRaw] = useState<Task[]>(saved?.tasks || []);
  const [modellIds, setModellIds] = useState<string[]>(saved?.modellIds || []);
  const [projektName] = useState<string>(saved?.name || "");
  const [ersteltVon] = useState<string>(saved?.ersteltVon || "");
  const [ersteltAm] = useState<string>(saved?.ersteltAm || "");
  const [neuModellIds, setNeuModellIds] = useState<string[]>([]);
  const [aktivTab, setAktivTab] = useState<"tasks" | "sim">("tasks");

  function setTasks(t: Task[]) {
    setTasksRaw(t);
    save({ tasks: t, modellIds, name: projektName, ersteltVon, ersteltAm });
  }

  function ganttAktualisieren(neueTasks: Task[]) {
    const merged = neueTasks.map(neu => {
      const alt = tasks.find(t => t.name.toLowerCase() === neu.name.toLowerCase());
      return alt ? { ...neu, typ: alt.typ, objektGuids: alt.objektGuids } : neu;
    });
    setTasks(merged);
  }

  function simulationErstellen() {
    const jetzt = new Date().toLocaleDateString("de-CH");
    const data = { tasks, modellIds: neuModellIds, name: "Simulation 1", ersteltVon: "Raphael B.", ersteltAm: jetzt };
    save(data);
    setModellIds(neuModellIds);
    setViewerState(prev => ({ ...prev, aktivesModellId: neuModellIds[0] || "" }));
    setView("home");
  }

  function simulationLoeschen() {
    if (confirm("Simulation und alle Verknüpfungen löschen?")) {
      localStorage.removeItem(KEY);
      setTasksRaw([]); setModellIds([]); setNeuModellIds([]);
      setView("home");
    }
  }

  const hatProjekt = tasks.length > 0;

  // ── 3D VIEWER ──────────────────────────────────────────
  if (isViewerContext) {
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
          <span className="task-count">{tasks.length} Tasks</span>
        </header>

        {!hatProjekt ? (
          <main>
            <div className="panel">
              <div className="tc-empty-state">
                <div className="tc-empty-icon">⚙️</div>
                <div className="tc-empty-title">Kein Projekt aktiv</div>
                <div className="tc-empty-sub">Erstelle eine Simulation im Projektbereich unter <strong>4D Bauablauf</strong>.</div>
              </div>
            </div>
          </main>
        ) : (
          <>
            <nav>
              <button className={aktivTab === "tasks" ? "active" : ""} onClick={() => setAktivTab("tasks")}>
                <span className="tab-icon">🔧</span><span>Bauteile</span>
              </button>
              <button className={aktivTab === "sim" ? "active" : ""} onClick={() => setAktivTab("sim")}>
                <span className="tab-icon">▶</span><span>Abspielen</span>
              </button>
            </nav>
            <main>
              {aktivTab === "tasks" && (
                <TaskList tasks={tasks} setTasks={setTasks} api={api}
                  viewerState={{ ...viewerState, aktivesModellId: modellIds[0] || viewerState.aktivesModellId }} />
              )}
              {aktivTab === "sim" && (
                <SimulationPlayer tasks={tasks} api={api}
                  aktivesModellId={modellIds[0] || viewerState.aktivesModellId} />
              )}
            </main>
          </>
        )}
      </div>
    );
  }

  // ── PROJEKT PANEL ──────────────────────────────────────

  // SETUP: Modelle wählen
  if (view === "neu-modelle") {
    return (
      <div className="app">
        <div className="tc-header">
          <button className="tc-back" onClick={() => setView("home")}>←</button>
          <div className="tc-header-title">Neue Simulation</div>
          <div className="tc-step-badge">Schritt 1 / 2</div>
        </div>
        <main>
          <div className="panel">
            <div className="tc-section-title">IFC-Modelle wählen</div>
            <p className="tc-section-sub">Wähle die Modelle aus der Projektablage.</p>

            {!accessToken && (
              <div className="tc-info-card">⟳ Verbinde mit Trimble Connect...</div>
            )}

            {accessToken && (
              <FileBrowser
                accessToken={accessToken}
                projectId={projectId}
                ausgewaehlteIds={neuModellIds}
                setAusgewaehlteIds={setNeuModellIds}
              />
            )}

            <div className="tc-action-row">
              <button className="tc-btn-ghost" onClick={() => setView("home")}>Abbrechen</button>
              <button
                className="tc-btn-primary"
                disabled={neuModellIds.length === 0}
                onClick={() => setView("neu-gantt")}
              >
                Weiter → Gantt
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // SETUP: Gantt laden
  if (view === "neu-gantt") {
    return (
      <div className="app">
        <div className="tc-header">
          <button className="tc-back" onClick={() => setView("neu-modelle")}>←</button>
          <div className="tc-header-title">Neue Simulation</div>
          <div className="tc-step-badge">Schritt 2 / 2</div>
        </div>
        <main>
          <div className="panel">
            <div className="tc-section-title">Gantt importieren</div>
            <p className="tc-section-sub">Excel (.xlsx) oder MS Project Export (.xml)</p>
            <GanttImport tasks={tasks} setTasks={setTasks} ganttAktualisieren={ganttAktualisieren} />
            <div className="tc-action-row">
              <button className="tc-btn-ghost" onClick={() => setView("neu-modelle")}>← Zurück</button>
              <button
                className="tc-btn-primary"
                disabled={tasks.length === 0}
                onClick={simulationErstellen}
              >
                ✓ Simulation erstellen
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // HOME
  return (
    <div className="app tc-projekt-panel">
      <div className="tc-panel-header">
        <div className="tc-panel-logo">
          <div className="tc-panel-icon">4D</div>
          <div>
            <div className="tc-panel-title">4D Bauablauf</div>
            <div className="tc-panel-sub">Bauablaufsimulation</div>
          </div>
        </div>
        <div className={`tc-status-dot ${connected ? "on" : "off"}`} title={connected ? "Verbunden" : "Verbinde..."} />
      </div>

      <main>
        <div className="tc-content">

          {/* Neue Simulation Button */}
          {!hatProjekt && (
            <button className="tc-new-btn" onClick={() => { setNeuModellIds([]); setView("neu-modelle"); }}>
              <div className="tc-new-plus">+</div>
              <div className="tc-new-text">
                <div className="tc-new-title">Neue Simulation erstellen</div>
                <div className="tc-new-sub">Modelle wählen · Gantt importieren · Bauteile verknüpfen</div>
              </div>
            </button>
          )}

          {/* Aktive Simulation */}
          {hatProjekt && (
            <>
              <div className="tc-section-title" style={{ marginBottom: 8 }}>Aktive Simulation</div>

              <div className="tc-projekt-card">
                <div className="tc-projekt-card-header">
                  <div className="tc-projekt-card-icon">📊</div>
                  <div className="tc-projekt-card-info">
                    <div className="tc-projekt-card-name">4D Bauablaufsimulation</div>
                    <div className="tc-projekt-card-meta">
                      Erstellt von {ersteltVon || "Raphael B."} · {ersteltAm || new Date().toLocaleDateString("de-CH")}
                    </div>
                  </div>
                </div>

                <div className="tc-projekt-stats">
                  <div className="tc-stat">
                    <div className="tc-stat-val">{tasks.length}</div>
                    <div className="tc-stat-label">Tasks</div>
                  </div>
                  <div className="tc-stat">
                    <div className="tc-stat-val">{tasks.filter(t => t.objektGuids.length > 0).length}</div>
                    <div className="tc-stat-label">Verknüpft</div>
                  </div>
                  <div className="tc-stat">
                    <div className="tc-stat-val">{tasks.reduce((s, t) => s + t.objektGuids.length, 0)}</div>
                    <div className="tc-stat-label">Bauteile</div>
                  </div>
                  <div className="tc-stat">
                    <div className="tc-stat-val">{modellIds.length}</div>
                    <div className="tc-stat-label">Modelle</div>
                  </div>
                </div>

                <div className="tc-projekt-modelle">
                  <div className="tc-pm-title">Modelle</div>
                  {modellIds.length === 0 && <div className="tc-pm-none">Keine Modelle verknüpft</div>}
                  {modellIds.map((id, i) => (
                    <div key={id} className="tc-pm-item">
                      <span className="tc-pm-icon">🏗️</span>
                      <span className="tc-pm-name">Modell {i + 1}</span>
                      <span className="tc-pm-id">{id.slice(0, 16)}...</span>
                    </div>
                  ))}
                </div>

                <div className="tc-projekt-tasks">
                  <div className="tc-pm-title">Tasks</div>
                  <div className="tc-task-list">
                    {tasks.slice(0, 5).map(t => (
                      <div key={t.id} className="tc-task-row">
                        <span className={`tc-task-dot ${t.typ}`}>●</span>
                        <span className="tc-task-name">{t.name}</span>
                        <span className="tc-task-count">{t.objektGuids.length > 0 ? `${t.objektGuids.length} ⬡` : "∅"}</span>
                      </div>
                    ))}
                    {tasks.length > 5 && (
                      <div className="tc-task-more">+ {tasks.length - 5} weitere Tasks</div>
                    )}
                  </div>
                </div>

                <div className="tc-projekt-actions">
                  <button className="tc-btn-secondary" onClick={() => { setNeuModellIds(modellIds); setView("neu-gantt"); }}>
                    ↻ Gantt aktualisieren
                  </button>
                  <button className="tc-btn-danger" onClick={simulationLoeschen}>
                    🗑 Löschen
                  </button>
                </div>
              </div>

              <div className="tc-hint-card">
                <div className="tc-hint-icon">💡</div>
                <div>
                  <div className="tc-hint-title">Weiter im 3D Viewer</div>
                  <div className="tc-hint-sub">Öffne den 3D Viewer und aktiviere die Extension um Bauteile zu verknüpfen und die Simulation abzuspielen.</div>
                </div>
              </div>

              <button className="tc-new-btn tc-new-btn-outline" onClick={() => { setNeuModellIds([]); setTasksRaw([]); setView("neu-modelle"); }}>
                <div className="tc-new-plus">+</div>
                <div className="tc-new-text">
                  <div className="tc-new-title">Neue Simulation erstellen</div>
                  <div className="tc-new-sub">Aktuelle Simulation wird überschrieben</div>
                </div>
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}