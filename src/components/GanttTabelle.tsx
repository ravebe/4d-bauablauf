import type { Task } from "../types";

interface Props { tasks: Task[]; }

function istGueltig(t: Task): boolean {
  return !!(t.name?.trim() && t.start?.trim() && t.end?.trim() &&
    ["neubau", "bestand", "abbruch"].includes(t.typ));
}

const thStyle: React.CSSProperties = {
  padding: "6px 10px", textAlign: "left", fontWeight: 600,
  fontSize: 10, textTransform: "uppercase", letterSpacing: ".3px",
  color: "var(--tc-text-2)", borderBottom: "1px solid var(--tc-border)",
  whiteSpace: "nowrap", background: "var(--tc-bg)"
};

const tdStyle: React.CSSProperties = {
  padding: "5px 10px", borderBottom: "1px solid var(--tc-border-light)",
  color: "var(--tc-text)", whiteSpace: "nowrap"
};

export default function GanttTabelle({ tasks }: Props) {
  if (!tasks.length) return null;
  const ungueltig = tasks.filter(t => !istGueltig(t)).length;

  return (
    <div>
      {ungueltig > 0 && (
        <div className="alert err" style={{ marginBottom: 8, fontSize: 11 }}>
          ⚠ {ungueltig} ungültige Zeile(n) – fehlende Pflichtfelder (Name, Start, Ende, Typ)
        </div>
      )}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 280, border: "1px solid var(--tc-border)", borderRadius: 6 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 440 }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Start</th>
              <th style={thStyle}>Ende</th>
              <th style={thStyle}>Typ</th>
              <th style={thStyle}>Bauteile</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, i) => {
              const ok = istGueltig(t);
              return (
                <tr key={t.id} style={{ background: ok ? "transparent" : "#FFF5F5" }}>
                  <td style={{ ...tdStyle, color: "var(--tc-text-3)" }}>{i + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 500, color: ok ? "var(--tc-text)" : "var(--tc-red)" }}>
                    {t.name || <span style={{ fontStyle: "italic" }}>–</span>}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", color: t.start ? "var(--tc-text)" : "var(--tc-red)" }}>
                    {t.start || <span style={{ fontStyle: "italic" }}>–</span>}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", color: t.end ? "var(--tc-text)" : "var(--tc-red)" }}>
                    {t.end || <span style={{ fontStyle: "italic" }}>–</span>}
                  </td>
                  <td style={tdStyle}>
                    {["neubau", "bestand", "abbruch"].includes(t.typ)
                      ? <span className={`typ-pill ${t.typ}`}>{t.typ}</span>
                      : <span style={{ color: "var(--tc-red)", fontStyle: "italic", fontSize: 10 }}>ungültig</span>}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--tc-blue)" }}>
                    {t.objektGuids?.length > 0
                      ? `⬡ ${t.objektGuids.length}`
                      : <span style={{ color: "#BDBDBD" }}>∅</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: "var(--tc-text-3)", marginTop: 4 }}>
        {tasks.length} Tasks · {tasks.filter(istGueltig).length} gültig
        {ungueltig > 0 && <span style={{ color: "var(--tc-red)" }}> · {ungueltig} ungültig</span>}
      </div>
    </div>
  );
}