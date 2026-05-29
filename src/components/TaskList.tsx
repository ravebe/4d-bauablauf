import { useState, useRef } from "react";
import type { Task, TaskTyp } from "../types";

interface Props {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  api: any;
  aktivesModellId: string;
}

interface AttributMap {
  [key: string]: Set<string>;
}

export default function TaskList({ tasks, setTasks, api, aktivesModellId }: Props) {
  const [aktiverTask, setAktiverTask] = useState<string | null>(null);
  const [attributKey, setAttributKey] = useState("");
  const [attributValue, setAttributValue] = useState("");
  const [laden, setLaden] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; typ: "ok" | "err" | "info" } | null>(null);
  const [attributMap, setAttributMap] = useState<AttributMap>({});
  const [attributeLaden, setAttributeLaden] = useState(false);
  const [keyVorschlaege, setKeyVorschlaege] = useState<string[]>([]);
  const [valueVorschlaege, setValueVorschlaege] = useState<string[]>([]);
  const [showKeyDrop, setShowKeyDrop] = useState(false);
  const [showValueDrop, setShowValueDrop] = useState(false);
  const keyRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);

  // Hilfsfunktion: Selektion normalisieren (verschiedene API-Formate)
  function normalisiereSelection(raw: any): number[] {
    if (!raw) return [];
    // Format: Array von Zahlen
    if (Array.isArray(raw) && raw.every((x: any) => typeof x === "number")) return raw;
    // Format: Array von Objekten mit id/entityId
    if (Array.isArray(raw)) {
      return raw
        .map((s: any) => {
          if (typeof s === "number") return s;
          if (s?.id != null) return Number(s.id);
          if (s?.entityId != null) return Number(s.entityId);
          if (s?.runtimeId != null) return Number(s.runtimeId);
          return null;
        })
        .filter((x): x is number => x !== null && !isNaN(x));
    }
    // Format: {data: [...]}
    if (raw?.data) return normalisiereSelection(raw.data);
    return [];
  }

  async function ladeAttribute() {
    if (!api || !aktivesModellId) return;
    setAttributeLaden(true);
    try {
      const objekte = await api.viewer.getObjects(aktivesModellId);
      const roheIds = Array.isArray(objekte) ? objekte : [];
      const ids = roheIds.slice(0, 150).map((o: any) => {
        if (typeof o === "string") return o;
        if (o?.id) return o.id;
        return String(o);
      });
      const eigenschaften = await api.viewer.getObjectProperties(aktivesModellId, ids);
      const map: AttributMap = {};
      const props = Array.isArray(eigenschaften) ? eigenschaften : [];
      for (const obj of props) {
        const gruppen = Array.isArray(obj?.properties) ? obj.properties : [];
        for (const gruppe of gruppen) {
          const propListe = Array.isArray(gruppe?.properties) ? gruppe.properties : [];
          for (const prop of propListe) {
            if (!prop?.name) continue;
            if (!map[prop.name]) map[prop.name] = new Set();
            if (prop.value != null) map[prop.name].add(String(prop.value));
          }
        }
      }
      setAttributMap(map);
    } catch (err) {
      console.error("Attribute laden:", err);
    } finally {
      setAttributeLaden(false);
    }
  }

  function onKeyChange(val: string) {
    setAttributKey(val);
    setAttributValue("");
    setValueVorschlaege([]);
    if (!val) { setKeyVorschlaege([]); setShowKeyDrop(false); return; }
    const treffer = Object.keys(attributMap)
      .filter(k => k.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 8);
    setKeyVorschlaege(treffer);
    setShowKeyDrop(treffer.length > 0);
  }

  function selectKey(k: string) {
    setAttributKey(k);
    setShowKeyDrop(false);
    setAttributValue("");
    const werte = attributMap[k] ? [...attributMap[k]].slice(0, 10) : [];
    setValueVorschlaege(werte);
    setShowValueDrop(werte.length > 0);
  }

  function onValueChange(val: string) {
    setAttributValue(val);
    if (!attributKey || !attributMap[attributKey]) { setShowValueDrop(false); return; }
    const werte = [...attributMap[attributKey]]
      .filter(v => v.toLowerCase().includes(val.toLowerCase()))
      .slice(0, 8);
    setValueVorschlaege(werte);
    setShowValueDrop(werte.length > 0);
  }

  function typAendern(taskId: string, typ: TaskTyp) {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, typ } : t));
  }

  function guidEntfernen(taskId: string, guid: string) {
    setTasks(tasks.map(t =>
      t.id === taskId ? { ...t, objektGuids: t.objektGuids.filter(g => g !== guid) } : t
    ));
  }

  function alleEntfernen(taskId: string) {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, objektGuids: [] } : t));
  }

  async function markiereImViewer(guids: string[]) {
    if (!api || !aktivesModellId || guids.length === 0) return;
    try {
      const runtimeIds = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, guids);
      await api.viewer.setSelection(runtimeIds);
    } catch (e) {
      console.warn("Markierung:", e);
    }
  }

  async function taskAnklicken(taskId: string) {
    const neuerTask = aktiverTask === taskId ? null : taskId;
    setAktiverTask(neuerTask);
    setMeldung(null);
    setAttributKey("");
    setAttributValue("");
    setShowKeyDrop(false);
    setShowValueDrop(false);

    if (neuerTask) {
      if (Object.keys(attributMap).length === 0) ladeAttribute();
      const task = tasks.find(t => t.id === taskId);
      if (task && task.objektGuids.length > 0) {
        markiereImViewer(task.objektGuids);
      }
    }
  }

  async function perAttributZuweisen(taskId: string) {
    if (!api || !aktivesModellId) { setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return; }
    if (!attributKey || !attributValue) { setMeldung({ text: "Bitte Attribut und Wert eingeben.", typ: "err" }); return; }
    setLaden(true);
    setMeldung({ text: "⟳ Suche Bauteile...", typ: "info" });
    try {
      const roheObjekte = await api.viewer.getObjects(aktivesModellId);
      const objekte = Array.isArray(roheObjekte) ? roheObjekte : [];
      const ids = objekte.map((o: any) => typeof o === "string" ? o : o?.id ?? String(o));
      const roheEigen = await api.viewer.getObjectProperties(aktivesModellId, ids);
      const eigenschaften = Array.isArray(roheEigen) ? roheEigen : [];
      const gefundeneGuids: string[] = [];

      for (const obj of eigenschaften) {
        const gruppen = Array.isArray(obj?.properties) ? obj.properties : [];
        let gefunden = false;
        for (const gruppe of gruppen) {
          if (gefunden) break;
          const propListe = Array.isArray(gruppe?.properties) ? gruppe.properties : [];
          for (const prop of propListe) {
            if (
              prop?.name?.toLowerCase().includes(attributKey.toLowerCase()) &&
              String(prop?.value ?? "").toLowerCase().includes(attributValue.toLowerCase())
            ) {
              gefundeneGuids.push(obj.id);
              gefunden = true;
              break;
            }
          }
        }
      }

      if (gefundeneGuids.length === 0) {
        setMeldung({ text: "Keine Bauteile mit diesem Attribut gefunden.", typ: "err" });
        setLaden(false);
        return;
      }

      await markiereImViewer(gefundeneGuids);
      setTasks(tasks.map(t =>
        t.id === taskId
          ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...gefundeneGuids])] }
          : t
      ));
      setMeldung({ text: `✓ ${gefundeneGuids.length} Bauteile gefunden und markiert.`, typ: "ok" });
    } catch (err) {
      console.error("Attribut-Filter:", err);
      setMeldung({ text: "Fehler bei der Suche. Siehe Konsole.", typ: "err" });
    } finally {
      setLaden(false);
    }
  }

  async function perKlickZuweisen(taskId: string) {
    if (!api || !aktivesModellId) { setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return; }
    try {
      setMeldung({ text: "⟳ Lese Selektion...", typ: "info" });
      const rawSel = await api.viewer.getSelection();
      console.log("Raw Selection:", rawSel);
      const runtimeIds = normalisiereSelection(rawSel);

      if (runtimeIds.length === 0) {
        setMeldung({ text: "Keine Bauteile ausgewählt. Bitte im 3D Viewer anklicken.", typ: "err" });
        return;
      }

      const guids = await api.viewer.convertToObjectIds(aktivesModellId, runtimeIds);
      const guidsArr = Array.isArray(guids) ? guids.filter(Boolean) : [];

      if (guidsArr.length === 0) {
        setMeldung({ text: "GUIDs konnten nicht gelesen werden.", typ: "err" });
        return;
      }

      setTasks(tasks.map(t =>
        t.id === taskId
          ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...guidsArr])] }
          : t
      ));
      setMeldung({ text: `✓ ${guidsArr.length} Bauteile übernommen.`, typ: "ok" });
    } catch (err) {
      console.error("Klick-Zuweisung:", err);
      setMeldung({ text: "Fehler beim Übernehmen.", typ: "err" });
    }
  }

  if (!aktivesModellId) {
    return (
      <div className="panel">
        <div className="alert warn">⚠ Kein Modell erkannt. Bitte zuerst "Modelle" Tab öffnen.</div>
      </div>
    );
  }

  return (
    <div className="panel" onClick={() => { setShowKeyDrop(false); setShowValueDrop(false); }}>
      <div className="section-header">
        <span>Bauteile zuweisen</span>
        <span style={{ fontSize: 10, color: "#555" }}>{tasks.length} Tasks</span>
      </div>

      {meldung && (
        <div className={`alert ${meldung.typ === "ok" ? "success" : meldung.typ === "err" ? "error" : "info-alert"}`}>
          {meldung.text}
        </div>
      )}

      {tasks.length === 0 && (
        <p className="hinweis" style={{ textAlign: "center", padding: "20px 0" }}>
          Bitte zuerst eine Gantt-Datei laden.
        </p>
      )}

      {tasks.map((task) => (
        <div key={task.id} className={`task-card ${aktiverTask === task.id ? "offen" : ""}`}>
          <div className="task-header" onClick={() => taskAnklicken(task.id)}>
            <span className={`typ-dot ${task.typ}`}>●</span>
            <span className="task-name">{task.name}</span>
            <div className="task-meta">
              <span className={`typ-badge ${task.typ}`}>{task.typ}</span>
              <span className="bauteil-count">
                {task.objektGuids.length > 0
                  ? <><span style={{ color: "#4da6ff" }}>⬡</span> {task.objektGuids.length}</>
                  : <span style={{ color: "#444" }}>∅</span>
                }
              </span>
              <span className="chevron">{aktiverTask === task.id ? "▲" : "▼"}</span>
            </div>
          </div>

          {aktiverTask === task.id && (
            <div className="task-detail" onClick={e => e.stopPropagation()}>

              {/* Typ */}
              <div className="detail-block">
                <div className="sub-label">Task-Typ</div>
                <div className="typ-auswahl">
                  {(["neubau", "bestand", "abbruch"] as TaskTyp[]).map((typ) => (
                    <button
                      key={typ}
                      className={`typ-btn ${task.typ === typ ? `aktiv-${typ}` : ""}`}
                      onClick={() => typAendern(task.id, typ)}
                    >
                      {typ === "neubau" ? "🟢" : typ === "bestand" ? "🟡" : "🔴"} {typ}
                    </button>
                  ))}
                </div>
              </div>

              {/* Attribut-Filter */}
              <div className="detail-block">
                <div className="sub-label">
                  IFC-Attribut Filter
                  {attributeLaden && <span className="laden-text"> ⟳ Lade Attribute...</span>}
                </div>

                <div ref={keyRef} className="autocomplete-wrap">
                  <input
                    className="attr-input"
                    placeholder="Attributname (z.B. Geschoss, Type...)"
                    value={attributKey}
                    onChange={e => { e.stopPropagation(); onKeyChange(e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    onFocus={() => keyVorschlaege.length > 0 && setShowKeyDrop(true)}
                  />
                  {showKeyDrop && (
                    <div className="dropdown" onClick={e => e.stopPropagation()}>
                      {keyVorschlaege.map(k => (
                        <div key={k} className="dropdown-item" onClick={() => selectKey(k)}>{k}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div ref={valueRef} className="autocomplete-wrap">
                  <input
                    className="attr-input"
                    placeholder="Wert (z.B. OG1, Beton, BA-03)"
                    value={attributValue}
                    onChange={e => { e.stopPropagation(); onValueChange(e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    onFocus={() => valueVorschlaege.length > 0 && setShowValueDrop(true)}
                  />
                  {showValueDrop && (
                    <div className="dropdown" onClick={e => e.stopPropagation()}>
                      {valueVorschlaege.map(v => (
                        <div key={v} className="dropdown-item" onClick={() => { setAttributValue(v); setShowValueDrop(false); }}>{v}</div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="btn-primary"
                  onClick={() => perAttributZuweisen(task.id)}
                  disabled={laden || !attributKey || !attributValue}
                >
                  {laden ? "⟳ Suche..." : "🔍 Suchen & Markieren"}
                </button>
              </div>

              {/* Mausklick */}
              <div className="detail-block">
                <div className="sub-label">Mausklick Zuweisung</div>
                <p className="hinweis">Bauteile im 3D Viewer anklicken, dann:</p>
                <button className="btn-secondary" onClick={() => perKlickZuweisen(task.id)}>
                  ✓ Ausgewählte Bauteile übernehmen
                </button>
              </div>

              {/* Zugewiesene Bauteile */}
              {task.objektGuids.length > 0 && (
                <div className="detail-block">
                  <div className="sub-label-row">
                    <span>{task.objektGuids.length} Bauteile zugewiesen</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-xs" onClick={() => markiereImViewer(task.objektGuids)}>
                        👁 Markieren
                      </button>
                      <button className="btn-xs danger" onClick={() => alleEntfernen(task.id)}>
                        🗑 Alle löschen
                      </button>
                    </div>
                  </div>
                  <div className="guid-liste">
                    {task.objektGuids.map(guid => (
                      <div key={guid} className="guid-item">
                        <span className="guid-text">{guid.slice(0, 20)}...</span>
                        <button className="btn-remove" onClick={() => guidEntfernen(task.id, guid)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}