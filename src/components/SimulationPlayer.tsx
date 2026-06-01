import { useState } from "react";
import type { Task } from "../types";

interface Props { tasks: Task[]; api: any; aktivesModellId: string; }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function SimulationPlayer({ tasks, api, aktivesModellId }: Props) {
  const [laeuft, setLaeuft] = useState(false);
  const [aktiverTaskId, setAktiverId] = useState<string | null>(null);
  const [dauer, setDauer] = useState(3);
  const [fortschritt, setFortschritt] = useState(0);

  const mitBauteilen = tasks.filter(t => t.objektGuids.length > 0);

  async function start() {
    if (!api || !aktivesModellId) return;
    setLaeuft(true); setFortschritt(0);

    const neubauGuids = tasks.filter(t => t.typ === "neubau").flatMap(t => t.objektGuids);
    if (neubauGuids.length > 0) {
      try {
        const nums = neubauGuids.map(Number).filter(n => !isNaN(n) && n >= 0);
        if (nums.length === neubauGuids.length) await api.viewer.setObjectState({ visible: false }, nums);
        else {
          const ids = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, neubauGuids);
          await api.viewer.setObjectState({ visible: false }, ids);
        }
      } catch {}
    }

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task.objektGuids.length) continue;
      setAktiverId(task.id);
      setFortschritt(Math.round((i / tasks.length) * 100));

      let rIds: number[] = task.objektGuids.map(Number).filter(n => !isNaN(n) && n >= 0);
      if (rIds.length !== task.objektGuids.length) {
        try { rIds = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, task.objektGuids); } catch { continue; }
      }

      if (task.typ === "neubau") {
        try { await api.viewer.setObjectState({ visible: true, color: "reset" }, rIds); await api.viewer.setSelection(rIds); } catch {}
        await sleep(dauer * 1000);
        try { await api.viewer.setSelection([]); } catch {}
      } else if (task.typ === "bestand") {
        await sleep(dauer * 1000);
      } else if (task.typ === "abbruch") {
        try { await api.viewer.setObjectState({ color: { r: 255, g: 200, b: 0, a: 1 } }, rIds); } catch {}
        await sleep(2000);
        try { await api.viewer.setObjectState({ visible: false, color: "reset" }, rIds); await api.viewer.setSelection([]); } catch {}
        const rest = dauer * 1000 - 2000;
        if (rest > 0) await sleep(rest);
      }
    }

    setFortschritt(100); setAktiverId(null); setLaeuft(false);
    try { await api.viewer.setSelection([]); } catch {}
  }

  async function stopp() {
    setLaeuft(false); setAktiverId(null); setFortschritt(0);
    try { await api.viewer.setSelection([]); } catch {}
  }

  if (!aktivesModellId) return (
    <div className="sim-wrap">
      <div className="alert info">⚠ Kein Modell aktiv.</div>
    </div>
  );

  return (
    <div className="sim-wrap">
      <div className="sim-settings">
        <div className="detail-block-title" style={{ marginBottom: 8 }}>Einstellungen</div>
        <div className="sim-setting-row">
          <label>Sekunden pro Task</label>
          <input type="number" min={1} max={30} value={dauer} onChange={e => setDauer(Number(e.target.value))} />
        </div>
        <div className="sim-hint">Abbruch: 2 Sek. gelb → ausgeblendet · Bestand: immer sichtbar</div>
      </div>

      {laeuft && (
        <div className="sim-progress">
          <div className="sim-progress-bar"><div className="sim-progress-fill" style={{ width: `${fortschritt}%` }} /></div>
          <div className="sim-progress-text">
            {fortschritt}% · {aktiverTaskId ? tasks.find(t => t.id === aktiverTaskId)?.name : ""}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--tc-text-2)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>
        Tasks ({mitBauteilen.length} mit Bauteilen)
      </div>

      {mitBauteilen.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--tc-text-3)", textAlign: "center", padding: "16px 0" }}>
          Noch keine Bauteile verknüpft.
        </div>
      ) : (
        <div className="sim-task-list">
          {tasks.map(task => (
            <div key={task.id} className={`sim-task-row ${aktiverTaskId === task.id ? "aktiv" : ""}`}>
              <span className={`task-row-dot ${task.typ}`} />
              <span className="sim-task-name">{task.name}</span>
              <span className="sim-task-count">
                {task.objektGuids.length > 0 ? `⬡ ${task.objektGuids.length}` : "∅"}
              </span>
              {aktiverTaskId === task.id && <span style={{ fontSize: 10, color: "var(--tc-blue)" }}>▶</span>}
            </div>
          ))}
        </div>
      )}

      <div className="sim-controls" style={{ marginTop: 10 }}>
        {!laeuft ? (
          <button className="btn-start" onClick={start} disabled={mitBauteilen.length === 0}>
            ▶ Simulation starten
          </button>
        ) : (
          <button className="btn-stop" onClick={stopp}>■ Stoppen</button>
        )}
        <button className="btn-reset" onClick={stopp} disabled={!laeuft && fortschritt === 0}>↺</button>
      </div>

      {aktiverTaskId && (
        <div className="sim-active-info">
          ▶ Läuft: {tasks.find(t => t.id === aktiverTaskId)?.name}
        </div>
      )}
    </div>
  );
}