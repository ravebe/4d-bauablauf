import { useState, useRef } from "react";
import type { Task, TaskTyp } from "../types";
import type { ViewerState } from "../hooks/useApi";
import { parseObjectIds } from "../hooks/useApi";

interface Props {
  tasks: Task[];
  setTasks: (t: Task[]) => void;
  api: any;
  viewerState: ViewerState;
}

interface PsetAttr { pset: string; name: string; key: string; }
interface AttrMap { [key: string]: Set<string>; }

const BATCH = 10;

export default function TaskList({ tasks, setTasks, api, viewerState }: Props) {
  const { selektion, aktivesModellId } = viewerState;
  const [aktiverTask, setAktiverTask] = useState<string | null>(null);
  const [attrSuche, setAttrSuche] = useState("");
  const [selectedAttr, setSelectedAttr] = useState<PsetAttr | null>(null);
  const [attrValue, setAttrValue] = useState("");
  const [laden, setLaden] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; typ: "ok" | "err" | "info" } | null>(null);
  const [attrMap, setAttrMap] = useState<AttrMap>({});
  const [allAttrs, setAllAttrs] = useState<PsetAttr[]>([]);
  const [attrLaden, setAttrLaden] = useState(false);
  const [showAttrDrop, setShowAttrDrop] = useState(false);
  const [valueVorschlaege, setValueVorschlaege] = useState<string[]>([]);
  const [showValueDrop, setShowValueDrop] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // KRITISCHER FIX: TC erwartet [{modelId, objectRuntimeIds: [...]}]
  async function setSelectionTC(runtimeIds: number[]) {
    if (!api || !aktivesModellId) return;
    try {
      await api.viewer.setSelection([{
        modelId: aktivesModellId,
        objectRuntimeIds: runtimeIds
      }]);
    } catch (e1) {
      try {
        await api.viewer.setSelection(runtimeIds);
      } catch (e2) {
        console.warn("setSelection fehlgeschlagen:", e2);
      }
    }
  }

  async function clearSelection() {
    if (!api) return;
    try {
      await api.viewer.setSelection([]);
    } catch {}
  }

  async function getProps(runtimeIds: number[]): Promise<any[]> {
    const all: any[] = [];
    for (let i = 0; i < runtimeIds.length; i += BATCH) {
      try {
        const r = await api.viewer.getObjectProperties(aktivesModellId, runtimeIds.slice(i, i + BATCH));
        if (Array.isArray(r)) all.push(...r);
      } catch {}
    }
    return all;
  }

  async function ladeAttr() {
    if (!api || !aktivesModellId) return;
    setAttrLaden(true);
    try {
      const rohe = await api.viewer.getObjects(aktivesModellId);
      const ids = parseObjectIds(rohe).slice(0, 60);
      if (!ids.length) { setAttrLaden(false); return; }
      const props = await getProps(ids);
      const map: AttrMap = {};
      const attrsMap = new Map<string, PsetAttr>();
      for (const obj of props) {
        for (const g of (obj?.properties || [])) {
          const pset = g?.name || g?.displayName || "Eigenschaften";
          for (const p of (g?.properties || [])) {
            if (!p?.name) continue;
            const key = `${pset}||${p.name}`;
            if (!map[key]) { map[key] = new Set(); attrsMap.set(key, { pset, name: p.name, key }); }
            if (p.value != null) map[key].add(String(p.value));
          }
        }
      }
      setAttrMap(map);
      setAllAttrs([...attrsMap.values()]);
      console.log("Attribute geladen:", attrsMap.size);
    } catch (e) { console.error("ladeAttr:", e); }
    finally { setAttrLaden(false); }
  }

  function gefiltert(): PsetAttr[] {
    if (!attrSuche) return allAttrs.slice(0, 10);
    return allAttrs.filter(a =>
      a.name.toLowerCase().includes(attrSuche.toLowerCase()) ||
      a.pset.toLowerCase().includes(attrSuche.toLowerCase())
    ).slice(0, 10);
  }

  function selectAttr(a: PsetAttr) {
    setSelectedAttr(a);
    setAttrSuche(`${a.pset} › ${a.name}`);
    setShowAttrDrop(false);
    setAttrValue("");
    const w = attrMap[a.key] ? [...attrMap[a.key]].slice(0, 12) : [];
    setValueVorschlaege(w);
    setShowValueDrop(w.length > 0);
  }

  function typAendern(id: string, typ: TaskTyp) {
    setTasks(tasks.map(t => t.id === id ? { ...t, typ } : t));
  }

  async function markiereGuids(guids: string[]) {
    if (!api || !aktivesModellId || !guids.length) return;
    try {
      const nums = guids.map(Number).filter(n => !isNaN(n) && n >= 0);
      if (nums.length === guids.length) {
        await setSelectionTC(nums);
      } else {
        const ids = await api.viewer.convertToObjectRuntimeIds(aktivesModellId, guids);
        await setSelectionTC(ids);
      }
    } catch (e) { console.warn("markiereGuids:", e); }
  }

  async function taskKlick(taskId: string) {
    const neu = aktiverTask === taskId ? null : taskId;
    setAktiverTask(neu); setMeldung(null);
    setAttrSuche(""); setSelectedAttr(null); setAttrValue("");
    setShowAttrDrop(false); setShowValueDrop(false);
    if (neu) {
      if (!allAttrs.length) ladeAttr();
      const t = tasks.find(x => x.id === taskId);
      if (t?.objektGuids.length) markiereGuids(t.objektGuids);
      else await clearSelection();
    } else {
      await clearSelection();
    }
  }

  async function perAttr(taskId: string) {
    if (!selectedAttr || !attrValue.trim()) {
      setMeldung({ text: "Attribut und Wert wählen.", typ: "err" }); return;
    }
    if (!api || !aktivesModellId) {
      setMeldung({ text: "Kein Modell aktiv.", typ: "err" }); return;
    }
    setLaden(true);
    setMeldung({ text: "⟳ Suche Bauteile...", typ: "info" });
    try {
      const rohe = await api.viewer.getObjects(aktivesModellId);
      const allIds = parseObjectIds(rohe);
      if (!allIds.length) {
        setMeldung({ text: "Keine Objekte gefunden.", typ: "err" });
        setLaden(false); return;
      }

      const props = await getProps(allIds);
      const treffer: number[] = [];
      const suchPset = selectedAttr.pset;
      const suchName = selectedAttr.name;
      const suchVal = attrValue.trim().toLowerCase();

      for (const obj of props) {
        const rId = Number(obj?.id);
        if (isNaN(rId)) continue;
        for (const g of (obj?.properties || [])) {
          const pset = g?.name || g?.displayName || "Eigenschaften";
          if (pset !== suchPset) continue;
          for (const p of (g?.properties || [])) {
            if (p?.name === suchName) {
              const val = String(p?.value ?? "").trim().toLowerCase();
              if (val === suchVal || val.includes(suchVal)) {
                treffer.push(rId);
                break;
              }
            }
          }
        }
      }

      console.log(`Gefunden: ${treffer.length} von ${props.length} Objekten`);

      if (!treffer.length) {
        setMeldung({ text: `Keine Bauteile mit ${suchName} = "${attrValue}" gefunden.`, typ: "err" });
        setLaden(false); return;
      }

      // NUR die gefundenen markieren
      await setSelectionTC(treffer);

      const guids = treffer.map(String);
      setTasks(tasks.map(t => t.id === taskId
        ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...guids])] } : t));
      setMeldung({ text: `✓ ${treffer.length} Bauteile gefunden und markiert.`, typ: "ok" });
    } catch (e) {
      console.error("perAttr:", e);
      setMeldung({ text: "Fehler bei Suche.", typ: "err" });
    } finally { setLaden(false); }
  }

  async function perKlick(taskId: string) {
    if (!selektion.length) {
      setMeldung({ text: "Keine Bauteile ausgewählt.", typ: "err" }); return;
    }
    const guids = selektion.map(String);
    setTasks(tasks.map(t => t.id === taskId
      ? { ...t, objektGuids: [...new Set([...t.objektGuids, ...guids])] } : t));
    setMeldung({ text: `✓ ${guids.length} Bauteile übernommen.`, typ: "ok" });
  }

  const aktTask = tasks.find(t => t.id === aktiverTask);

  if (!aktivesModellId) return (
    <div style={{ padding: 16 }}>
      <div className="alert info">⚠ Kein Modell aktiv. Lade ein IFC-Modell im 3D Viewer.</div>
    </div>
  );

  return (
    <div className="tasklist-wrap" ref={panelRef}
      onClick={() => { setShowAttrDrop(false); setShowValueDrop(false); }}>

      {/* ── GANTT SECTION ── */}
      <div className="gantt-section">
        <div className="gantt-section-header">
          Gantt · {tasks.length} Tasks
          {selektion.length > 0 && (
            <span style={{ marginLeft: 8, color: "var(--tc-blue)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              ● {selektion.length} ausgewählt
            </span>
          )}
        </div>
        {tasks.map(task => (
          <div key={task.id}
            className={`task-row ${aktiverTask === task.id ? "active" : ""}`}
            onClick={() => taskKlick(task.id)}>
            <span className={`task-row-dot ${task.typ}`} />
            <span className="task-row-name">{task.name}</span>
            <span className="task-row-date">{task.start}</span>
            <span className={`task-row-count ${task.objektGuids.length === 0 ? "empty" : ""}`}>
              {task.objektGuids.length > 0 ? `⬡ ${task.objektGuids.length}` : "∅"}
            </span>
          </div>
        ))}
      </div>

      {/* ── DETAIL SECTION ── */}
      <div className="detail-section" onClick={e => e.stopPropagation()}>
        {!aktTask ? (
          <div className="detail-empty">↑ Task anklicken um Bauteile zuzuweisen</div>
        ) : (
          <>
            <div className="detail-header">
              <span className={`task-row-dot ${aktTask.typ}`} style={{ width: 9, height: 9 }} />
              <span className="detail-task-name">{aktTask.name}</span>
              <span style={{ fontSize: 10, color: "var(--tc-text-3)" }}>{aktTask.start}</span>
            </div>

            {meldung && (
              <div style={{ padding: "6px 12px" }}>
                <div className={`alert ${meldung.typ}`}>{meldung.text}</div>
              </div>
            )}

            {/* Typ */}
            <div className="detail-block">
              <div className="detail-block-title">Task-Typ</div>
              <div className="typ-btns">
                {(["neubau", "bestand", "abbruch"] as TaskTyp[]).map(typ => (
                  <button key={typ}
                    className={`typ-btn ${aktTask.typ === typ ? `aktiv-${typ}` : ""}`}
                    onClick={() => typAendern(aktTask.id, typ)}>
                    {typ === "neubau" ? "🟢" : typ === "bestand" ? "🟡" : "🔴"} {typ}
                  </button>
                ))}
              </div>
            </div>

            {/* IFC Attribut Filter */}
            <div className="detail-block">
              <div className="detail-block-title">
                IFC-Attribut Filter
                {attrLaden && <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 6, color: "var(--tc-text-3)" }}>⟳</span>}
                {allAttrs.length > 0 && <span style={{ fontWeight: 400, textTransform: "none", marginLeft: 6, color: "var(--tc-text-3)" }}>{allAttrs.length} Attr.</span>}
              </div>

              <div className="ac-wrap" onClick={e => e.stopPropagation()}>
                <input className="ac-input"
                  placeholder="PSet oder Attributname suchen..."
                  value={attrSuche}
                  onChange={e => { setAttrSuche(e.target.value); setSelectedAttr(null); setShowAttrDrop(true); }}
                  onFocus={() => setShowAttrDrop(true)} />
                {showAttrDrop && gefiltert().length > 0 && (
                  <div className="ac-dropdown">
                    {gefiltert().map(a => (
                      <div key={a.key} className="ac-item" onMouseDown={() => selectAttr(a)}>
                        <span className="pset">{a.pset} › </span><strong>{a.name}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ac-wrap" onClick={e => e.stopPropagation()}>
                <input className="ac-input"
                  placeholder="Wert..."
                  value={attrValue}
                  disabled={!selectedAttr}
                  onChange={e => {
                    setAttrValue(e.target.value);
                    if (selectedAttr && attrMap[selectedAttr.key]) {
                      const w = [...attrMap[selectedAttr.key]]
                        .filter(v => v.toLowerCase().includes(e.target.value.toLowerCase()))
                        .slice(0, 10);
                      setValueVorschlaege(w); setShowValueDrop(w.length > 0);
                    }
                  }}
                  onFocus={() => valueVorschlaege.length > 0 && setShowValueDrop(true)} />
                {showValueDrop && valueVorschlaege.length > 0 && (
                  <div className="ac-dropdown">
                    {valueVorschlaege.map(v => (
                      <div key={v} className="ac-item"
                        onMouseDown={() => { setAttrValue(v); setShowValueDrop(false); }}>{v}</div>
                    ))}
                  </div>
                )}
              </div>

              <button className="tc-btn-primary" style={{ width: "100%", marginTop: 4 }}
                onClick={() => perAttr(aktTask.id)}
                disabled={laden || !selectedAttr || !attrValue.trim()}>
                {laden ? "⟳ Suche..." : "🔍 Suchen & Markieren"}
              </button>
            </div>

            {/* Mausklick */}
            <div className="detail-block">
              <div className="detail-block-title">Mausklick Zuweisung</div>
              <div className={`sel-status ${selektion.length > 0 ? "aktiv" : ""}`}>
                {selektion.length > 0
                  ? `✓ ${selektion.length} Bauteil(e) ausgewählt`
                  : "Im 3D Viewer Bauteile anklicken"}
              </div>
              <button className="tc-btn-secondary" style={{ width: "100%" }}
                onClick={() => perKlick(aktTask.id)}
                disabled={selektion.length === 0}>
                ✓ Übernehmen ({selektion.length})
              </button>
            </div>

            {/* Zugewiesene Bauteile */}
            <div className="detail-block">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div className="detail-block-title" style={{ marginBottom: 0 }}>
                  {aktTask.objektGuids.length} Bauteile
                </div>
                {aktTask.objektGuids.length > 0 && (
                  <div style={{ display: "flex", gap: 5 }}>
                    <button style={{ fontSize: 10, background: "none", border: "1px solid var(--tc-border)", borderRadius: 3, padding: "2px 8px", cursor: "pointer", color: "var(--tc-blue)" }}
                      onClick={() => markiereGuids(aktTask.objektGuids)}>
                      👁 Markieren
                    </button>
                    <button style={{ fontSize: 10, background: "none", border: "1px solid var(--tc-border)", borderRadius: 3, padding: "2px 8px", cursor: "pointer", color: "var(--tc-red)" }}
                      onClick={() => setTasks(tasks.map(t => t.id === aktTask.id ? { ...t, objektGuids: [] } : t))}>
                      🗑 Alle
                    </button>
                  </div>
                )}
              </div>
              {aktTask.objektGuids.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--tc-text-3)", textAlign: "center", padding: "6px 0" }}>
                  Noch keine Bauteile verknüpft
                </div>
              ) : (
                <div className="guid-list">
                  {aktTask.objektGuids.map(guid => (
                    <div key={guid} className="guid-row">
                      <span style={{ flex: 1 }}>{guid.slice(0, 24)}...</span>
                      <button className="guid-row-x"
                        onClick={() => setTasks(tasks.map(t => t.id === aktTask.id
                          ? { ...t, objektGuids: t.objektGuids.filter(g => g !== guid) } : t))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}