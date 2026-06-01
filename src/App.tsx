import { useState } from "react";
import { useApi } from "./hooks/useApi";
import type { Task } from "./types";
import FileBrowser from "./components/FileBrowser";
import GanttImport from "./components/GanttImport";
import TaskList from "./components/TaskList";
import SimulationPlayer from "./components/SimulationPlayer";

type SetupStep = "home" | "modelle" | "gantt";

const KEY = "4d-v6";

function load() {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch {}
  return null;
}
function save(data: any) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} }

export default function App() {
  const { api, connected, isViewerContext, accessToken, projectId, viewerState, setViewerState } = useApi();
  const saved = load();

  const [step, setStep] = useState<SetupStep>("home");
  const [tasks, setTasksRaw] = useState<Task[]>(saved?.tasks || []);
  const [modellIds, setModellIds] = useState<string[]>(saved?.modellIds || []);
  const [neuModellIds, setNeuModellIds] = useState<string[]>([]);
  const [aktivTab, setAktivTab] = useState<"bauteile" | "simulation">("bauteile");

  const hatProjekt = tasks.length > 0;
  const ersteltAm = saved?.ersteltAm || new Date().toLocaleDateString("de-CH");

  function setTasks(t: Task[]) {
    setTasksRaw(t);
    save({ tasks: t, modellIds, ersteltAm });
  }

  function ganttAktualisieren(neueTasks: Task[]) {
    const merged = neueTasks.map(neu => {
      const alt = tasks.find(t => t.name.toLowerCase() === neu.name.toLowerCase());
      return alt ? { ...neu, typ: alt.typ, objektGuids: alt.objektGuids } : neu;
    });
    setTasks(merged);
  }

  function simulationErstellen() {
    const data = { tasks, modellIds: neuModellIds, ersteltAm: new Date().toLocaleDateString("de-CH") };
    save(data);
    setModellIds(neuModellIds);
    setViewerState(prev => ({ ...prev, aktivesModellId: neuModellIds[0] || prev.aktivesModellId }));
    setStep("home");
  }

  function simulationLoeschen() {
    if (confirm("Simulation und alle Verknüpfungen löschen?")) {
      localStorage.removeItem(KEY);
      setTasksRaw([]); setModellIds([]); setNeuModellIds([]);
      setStep("home");
    }
  }

  // ── VIEWER ──────────────────────────────────────────────
  if (isViewerContext) {
    return (
      <div className="app viewer-app">
        <div className="tc-header">
          <div className="tc-header-left">
            <div className="tc-logo">4D</div>
            <span className="tc-header-title">4D Bauablauf</span>
          </div>
          <div className="tc-header-right">
            {hatProjekt && <span className="tc-task-badge">{tasks.length} Tasks</span>}
            <span className={`tc-dot ${connected ? "on" : "off"}`} />
          </div>
        </div>

        {!hatProjekt ? (
          <div className="tc-empty">
            <div className="tc-empty-icon">⚙️</div>
            <div className="tc-empty-title">Kein Projekt aktiv</div>
            <div className="tc-empty-sub">Erstelle eine Simulation im Projektbereich unter <strong>4D Bauablauf</strong>.</div>
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
                <TaskList
                  tasks={tasks} setTasks={setTasks} api={api}
                  viewerState={{ ...viewerState, aktivesModellId: modellIds[0] || viewerState.aktivesModellId }}
                />
              )}
              {aktivTab === "simulation" && (
                <SimulationPlayer tasks={tasks} api={api}
                  aktivesModellId={modellIds[0] || viewerState.aktivesModellId} />
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── PROJEKTPANEL ─────────────────────────────────────────

  if (step === "modelle") {
    return (
      <div className="app setup-app">
        <div className="tc-header">
          <button className="tc-back-btn" onClick={() => setStep("home")}>←</button>
          <span className="tc-header-title">Neue Simulation</span>
          <span className="tc-step-pill">Schritt 1 / 2</span>
        </div>
        <div className="tc-setup-content">
          <div className="tc-section-label">IFC-Modelle aus Ablage wählen</div>
          <p className="tc-section-desc">Wähle die Modelle für diese Simulation.</p>
          {!accessToken
            ? <div className="tc-info-banner">⟳ Verbinde mit Trimble Connect...</div>
            : <FileBrowser accessToken={accessToken} projectId={projectId}
                ausgewaehlteIds={neuModellIds} setAusgewaehlteIds={setNeuModellIds} />
          }
          <div className="tc-actions">
            <button className="tc-btn-ghost" onClick={() => setStep("home")}>Abbrechen</button>
            <button className="tc-btn-primary" disabled={neuModellIds.length === 0}
              onClick={() => setStep("gantt")}>
              Weiter → Gantt
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "gantt") {
    return (
      <div className="app setup-app">
        <div className="tc-header">
          <button className="tc-back-btn" onClick={() => setStep("modelle")}>←</button>
          <span className="tc-header-title">Neue Simulation</span>
          <span className="tc-step-pill">Schritt 2 / 2</span>
        </div>
        <div className="tc-setup-content">
          <div className="tc-section-label">Gantt importieren</div>
          <p className="tc-section-desc">Excel (.xlsx) oder MS Project Export (.xml)</p>
          <GanttImport tasks={tasks} setTasks={setTasks} ganttAktualisieren={ganttAktualisieren} />
          <div className="tc-actions">
            <button className="tc-btn-ghost" onClick={() => setStep("modelle")}>← Zurück</button>
            <button className="tc-btn-green" disabled={tasks.length === 0} onClick={simulationErstellen}>
              ✓ Simulation erstellen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // HOME
  return (
    <div className="app setup-app">
      <div className="tc-header">
        <div className="tc-header-left">
          <div className="tc-logo">4D</div>
          <span className="tc-header-title">4D Bauablauf</span>
        </div>
        <span className={`tc-dot ${connected ? "on" : "off"}`} />
      </div>

      <div className="tc-setup-content">
        <div className="tc-section-label">Simulationen</div>

        {!hatProjekt && (
          <button className="tc-new-card" onClick={() => { setNeuModellIds([]); setStep("modelle"); }}>
            <div className="tc-new-circle">+</div>
            <div>
              <div className="tc-new-title">Neue Simulation erstellen</div>
              <div className="tc-new-sub">Modelle wählen · Gantt importieren</div>
            </div>
          </button>
        )}

        {hatProjekt && (
          <>
            <div className="tc-projekt-card">
              <div className="tc-pk-header">
                <span className="tc-pk-icon">📊</span>
                <div className="tc-pk-info">
                  <div className="tc-pk-name">4D Bauablaufsimulation</div>
                  <div className="tc-pk-meta">Erstellt {ersteltAm} · {modellIds.length} Modell(e)</div>
                </div>
              </div>

              <div className="tc-pk-stats">
                <div className="tc-stat"><div className="tc-stat-n">{tasks.length}</div><div className="tc-stat-l">Tasks</div></div>
                <div className="tc-stat"><div className="tc-stat-n">{tasks.filter(t => t.objektGuids.length > 0).length}</div><div className="tc-stat-l">Verknüpft</div></div>
                <div className="tc-stat"><div className="tc-stat-n">{tasks.reduce((s, t) => s + t.objektGuids.length, 0)}</div><div className="tc-stat-l">Bauteile</div></div>
                <div className="tc-stat"><div className="tc-stat-n">{modellIds.length}</div><div className="tc-stat-l">Modelle</div></div>
              </div>

              <div className="tc-pk-tasks">
                <div className="tc-pk-tasks-title">Tasks</div>
                {tasks.slice(0, 6).map(t => (
                  <div key={t.id} className="tc-pk-task-row">
                    <span className={`tc-pk-dot ${t.typ}`} />
                    <span className="tc-pk-task-name">{t.name}</span>
                    <span className="tc-pk-task-date">{t.start}</span>
                    <span className="tc-pk-task-count">
                      {t.objektGuids.length > 0 ? `⬡ ${t.objektGuids.length}` : "∅"}
                    </span>
                  </div>
                ))}
                {tasks.length > 6 && (
                  <div className="tc-pk-more">+ {tasks.length - 6} weitere Tasks</div>
                )}
              </div>

              <div className="tc-pk-footer">
                <button className="tc-btn-secondary" onClick={() => { setNeuModellIds(modellIds); setStep("gantt"); }}>
                  ↻ Gantt aktualisieren
                </button>
                <button className="tc-btn-danger" onClick={simulationLoeschen}>🗑</button>
              </div>
            </div>

            <div className="tc-hint">
              <span className="tc-hint-icon">💡</span>
              <div>
                <div className="tc-hint-title">Weiter im 3D Viewer</div>
                <div className="tc-hint-desc">Öffne den 3D Viewer und aktiviere die Extension um Bauteile zu verknüpfen.</div>
              </div>
            </div>

            <button className="tc-new-card tc-new-card-outline"
              onClick={() => { setNeuModellIds([]); setTasksRaw([]); setStep("modelle"); }}>
              <div className="tc-new-circle tc-new-circle-gray">+</div>
              <div>
                <div className="tc-new-title">Neue Simulation</div>
                <div className="tc-new-sub">Aktuelle wird überschrieben</div>
              </div>
            </button>
          </>
        )}
      </div>
    </div>
  );
}