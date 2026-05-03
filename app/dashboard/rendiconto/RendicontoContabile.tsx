'use client'

import { useState, useMemo, useRef } from "react";
import { useState, useMemo, useRef } from "react";

// ── Sample data (replace with Supabase fetch) ──────────────────────────
const SAMPLE_DATA = [
  { id: 1, data: "2026-04-28", tour: "Capri Full Day", barca: "Ariel", fornitore: "Nautica Ferrara", pax: 12, importo: 960 },
  { id: 2, data: "2026-04-28", tour: "Costiera Amalfitana", barca: "Poseidon", fornitore: "Salerno Boats", pax: 8, importo: 720 },
  { id: 3, data: "2026-04-27", tour: "Capri Full Day", barca: "Stella Marina", fornitore: "Nautica Ferrara", pax: 10, importo: 800 },
  { id: 4, data: "2026-04-27", tour: "Costiera Amalfitana", barca: "Luna", fornitore: "Mare Nostrum Srl", pax: 6, importo: 540 },
  { id: 5, data: "2026-04-26", tour: "Capri + Grotta Azzurra", barca: "Ariel", fornitore: "Nautica Ferrara", pax: 14, importo: 1260 },
  { id: 6, data: "2026-04-26", tour: "Sunset Tour", barca: "Venere", fornitore: "Salerno Boats", pax: 10, importo: 600 },
  { id: 7, data: "2026-04-25", tour: "Costiera Amalfitana", barca: "Poseidon", fornitore: "Salerno Boats", pax: 9, importo: 810 },
  { id: 8, data: "2026-04-25", tour: "Capri Full Day", barca: "Nettuno", fornitore: "Mare Nostrum Srl", pax: 11, importo: 880 },
  { id: 9, data: "2026-04-24", tour: "Capri Full Day", barca: "Stella Marina", fornitore: "Nautica Ferrara", pax: 12, importo: 960 },
  { id: 10, data: "2026-04-24", tour: "Li Galli + Amalfi", barca: "Luna", fornitore: "Mare Nostrum Srl", pax: 7, importo: 630 },
  { id: 11, data: "2026-04-23", tour: "Sunset Tour", barca: "Venere", fornitore: "Salerno Boats", pax: 10, importo: 600 },
  { id: 12, data: "2026-04-23", tour: "Capri + Grotta Azzurra", barca: "Ariel", fornitore: "Nautica Ferrara", pax: 15, importo: 1350 },
  { id: 13, data: "2026-04-22", tour: "Costiera Amalfitana", barca: "Poseidon", fornitore: "Salerno Boats", pax: 8, importo: 720 },
  { id: 14, data: "2026-04-22", tour: "Capri Full Day", barca: "Nettuno", fornitore: "Mare Nostrum Srl", pax: 10, importo: 800 },
];

const COMMISSION_RATE = 0.18;

const fmt = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtDateFile = (iso) => iso ? iso.replace(/-/g, "") : "all";

const VIEW_MODES = {
  completo: { label: "Estratto Conto Completo", icon: "💰", desc: "Tutti i dati contabili — per invio al fornitore" },
  rotazione: { label: "Rotazione Vendite", icon: "🔄", desc: "Solo operatività, senza importi — per i soci" },
};

export default function RendicontoContabile() {
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [fornitoreFilter, setFornitoreFilter] = useState("all");
  const [sortCol, setSortCol] = useState("data");
  const [sortDir, setSortDir] = useState("desc");
  const [viewMode, setViewMode] = useState("completo");
  const [exportOpen, setExportOpen] = useState(false);
  const [hoveredExport, setHoveredExport] = useState(null);

  const isCompleto = viewMode === "completo";

  const fornitori = useMemo(() => [...new Set(SAMPLE_DATA.map((r) => r.fornitore))].sort(), []);

  const rows = useMemo(() => {
    let filtered = SAMPLE_DATA.filter((r) => {
      if (dataInizio && r.data < dataInizio) return false;
      if (dataFine && r.data > dataFine) return false;
      if (fornitoreFilter !== "all" && r.fornitore !== fornitoreFilter) return false;
      return true;
    });
    filtered.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return filtered;
  }, [dataInizio, dataFine, fornitoreFilter, sortCol, sortDir]);

  const enriched = useMemo(
    () => rows.map((r) => ({ ...r, commissione: r.importo * COMMISSION_RATE, saldoFornitore: r.importo * (1 - COMMISSION_RATE) })),
    [rows]
  );

  const totals = useMemo(
    () => enriched.reduce((acc, r) => ({
      pax: acc.pax + r.pax, importo: acc.importo + r.importo,
      commissione: acc.commissione + r.commissione, saldoFornitore: acc.saldoFornitore + r.saldoFornitore,
    }), { pax: 0, importo: 0, commissione: 0, saldoFornitore: 0 }),
    [enriched]
  );

  const perFornitore = useMemo(() => {
    const map = {};
    enriched.forEach((r) => {
      if (!map[r.fornitore]) map[r.fornitore] = { importo: 0, commissione: 0, saldo: 0, pax: 0, count: 0 };
      map[r.fornitore].importo += r.importo;
      map[r.fornitore].commissione += r.commissione;
      map[r.fornitore].saldo += r.saldoFornitore;
      map[r.fornitore].pax += r.pax;
      map[r.fornitore].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].saldo - a[1].saldo);
  }, [enriched]);

  const perBarca = useMemo(() => {
    const map = {};
    enriched.forEach((r) => {
      if (!map[r.barca]) map[r.barca] = { fornitore: r.fornitore, pax: 0, count: 0, tours: new Set() };
      map[r.barca].pax += r.pax;
      map[r.barca].count += 1;
      map[r.barca].tours.add(r.tour);
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [enriched]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 11 }}>⇅</span>;
    return <span style={{ marginLeft: 4, fontSize: 11 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  // ── Exports ───────────────────────────────────────────────────────────
  const download = (content, filename) => {
    const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.click(); URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const exportRotazioneCSV = () => {
    const header = "Data,Tour,Barca,Fornitore,Pax\n";
    const body = enriched.map(r => `${r.data},"${r.tour}","${r.barca}","${r.fornitore}",${r.pax}`).join("\n");
    const totLine = `\nTOTALE,,,,${totals.pax}`;
    const barcaHeader = "\n\nRIEPILOGO PER BARCA\nBarca,Fornitore,Tour Effettuati,Pax Totali\n";
    const barcaBody = perBarca.map(([name, d]) => `"${name}","${d.fornitore}",${d.count},${d.pax}`).join("\n");
    download(header + body + totLine + barcaHeader + barcaBody, `rotazione_vendite_${fmtDateFile(dataInizio)}_${fmtDateFile(dataFine)}.csv`);
  };

  const exportEstratoContoCSV = () => {
    const supplierName = fornitoreFilter !== "all" ? fornitoreFilter : "tutti";
    const header = "Data,Tour,Barca,Fornitore,Pax,Importo Pagato,Commissione 18%,Saldo Fornitore\n";
    const body = enriched.map(r =>
      `${r.data},"${r.tour}","${r.barca}","${r.fornitore}",${r.pax},${r.importo.toFixed(2)},${r.commissione.toFixed(2)},${r.saldoFornitore.toFixed(2)}`
    ).join("\n");
    const totLine = `\nTOTALE,,,,${totals.pax},${totals.importo.toFixed(2)},${totals.commissione.toFixed(2)},${totals.saldoFornitore.toFixed(2)}`;
    const slug = supplierName.toLowerCase().replace(/[^a-z0-9]/g, "_");
    download(header + body + totLine, `estratto_conto_${slug}_${fmtDateFile(dataInizio)}_${fmtDateFile(dataFine)}.csv`);
  };

  // ── Palette ───────────────────────────────────────────────────────────
  const P = {
    bg: "#f8f9fc", card: "#fff", border: "#e2e6ef", text: "#1a1f36", muted: "#6b7394",
    primary: "#0047AB", primaryLt: "#e8f0fe", accent: "#00875a", accentLt: "#e3fcef",
    orange: "#e07c00", headerBg: "#f1f3f9",
    rotAccent: "#7c3aed", rotLt: "#ede9fe",
  };
  const modeAccent = isCompleto ? P.primary : P.rotAccent;
  const modeLt = isCompleto ? P.primaryLt : P.rotLt;
  const barColors = ["#0047AB", "#7c3aed", "#00875a", "#e07c00", "#de350b", "#0891b2"];
  const maxBarCount = perBarca.length > 0 ? Math.max(...perBarca.map(([, d]) => d.count)) : 1;

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", color: P.text, background: P.bg, minHeight: "100vh", padding: "24px 20px" }} onClick={() => exportOpen && setExportOpen(false)}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          {isCompleto ? "💰" : "🔄"} Rendiconto {isCompleto ? "Contabile" : "Rotazione Vendite"}
          {isCompleto && <span style={{ fontSize: 11, fontWeight: 600, background: modeLt, color: modeAccent, padding: "3px 10px", borderRadius: 20 }}>Commissione {COMMISSION_RATE * 100}%</span>}
        </h1>
      </div>

      {/* ── View Mode Toggle ── */}
      <div style={{ display: "flex", gap: 0, background: P.card, border: `1px solid ${P.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
        {Object.entries(VIEW_MODES).map(([key, m]) => (
          <button key={key} onClick={() => setViewMode(key)} style={{
            flex: 1, padding: "14px 20px", border: "none", cursor: "pointer",
            background: viewMode === key ? modeLt : "transparent",
            borderBottom: viewMode === key ? `3px solid ${modeAccent}` : "3px solid transparent",
            display: "flex", alignItems: "center", gap: 10, transition: "all .2s",
          }}>
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: viewMode === key ? 700 : 500, color: viewMode === key ? modeAccent : P.text }}>{m.label}</div>
              <div style={{ fontSize: 11, color: P.muted, marginTop: 1 }}>{m.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: P.muted }}>Data inizio</span>
          <input type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} style={{ fontSize: 14, padding: "8px 12px", border: `1px solid ${P.border}`, borderRadius: 8, outline: "none", background: P.bg, color: P.text, minWidth: 140 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: P.muted }}>Data fine</span>
          <input type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} style={{ fontSize: 14, padding: "8px 12px", border: `1px solid ${P.border}`, borderRadius: 8, outline: "none", background: P.bg, color: P.text, minWidth: 140 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: P.muted }}>Fornitore</span>
          <select value={fornitoreFilter} onChange={(e) => setFornitoreFilter(e.target.value)} style={{ fontSize: 14, padding: "8px 12px", border: `1px solid ${P.border}`, borderRadius: 8, outline: "none", background: P.bg, color: P.text, minWidth: 180, cursor: "pointer" }}>
            <option value="all">Tutti i fornitori</option>
            {fornitori.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignSelf: "flex-end" }}>
          <button onClick={() => { setDataInizio(""); setDataFine(""); setFornitoreFilter("all"); }} style={{ fontSize: 12, padding: "8px 14px", border: `1px solid ${P.border}`, borderRadius: 8, background: "transparent", cursor: "pointer", color: P.muted }}>Reset</button>
          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setExportOpen(!exportOpen)} style={{
              fontSize: 13, fontWeight: 600, padding: "9px 18px", border: `1px solid ${modeAccent}`,
              borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              background: modeLt, color: modeAccent, transition: "all .2s",
            }}>⬇ Esporta ▾</button>
            {exportOpen && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: P.card, border: `1px solid ${P.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 100, minWidth: 280, overflow: "hidden" }}>
                <div
                  style={{ padding: "14px 18px", cursor: "pointer", borderBottom: `1px solid ${P.border}`, background: hoveredExport === "rot" ? P.bg : "transparent", transition: "background .15s" }}
                  onMouseEnter={() => setHoveredExport("rot")}
                  onMouseLeave={() => setHoveredExport(null)}
                  onClick={exportRotazioneCSV}
                >
                  <div><span style={{ fontSize: 16, marginRight: 8 }}>🔄</span><span style={{ fontSize: 13, fontWeight: 600 }}>Rotazione Vendite (senza prezzi)</span></div>
                  <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>Per i soci — solo date, tour, barche e pax</div>
                </div>
                <div
                  style={{ padding: "14px 18px", cursor: "pointer", background: hoveredExport === "ec" ? P.bg : "transparent", transition: "background .15s" }}
                  onMouseEnter={() => setHoveredExport("ec")}
                  onMouseLeave={() => setHoveredExport(null)}
                  onClick={exportEstratoContoCSV}
                >
                  <div><span style={{ fontSize: 16, marginRight: 8 }}>💰</span><span style={{ fontSize: 13, fontWeight: 600 }}>Estratto Conto Completo</span></div>
                  <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>
                    Per il fornitore — importi, commissioni e saldi
                    {fornitoreFilter !== "all" && <strong> · {fornitoreFilter}</strong>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {isCompleto ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { value: fmt(totals.importo), label: "Totale incassato", color: P.primary },
            { value: fmt(totals.commissione), label: "Commissioni Blu Alliance", color: P.accent },
            { value: fmt(totals.saldoFornitore), label: "Da erogare ai fornitori", color: P.orange },
            { value: totals.pax, label: `Passeggeri · ${enriched.length} tour`, color: P.muted },
          ].map((c, i) => (
            <div key={i} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "18px 20px", borderLeft: `4px solid ${c.color}` }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
              <p style={{ fontSize: 12, color: P.muted, fontWeight: 500, marginTop: 2 }}>{c.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { value: enriched.length, label: "Tour effettuati", color: P.rotAccent },
            { value: totals.pax, label: "Passeggeri totali", color: "#0891b2" },
            { value: perBarca.length, label: "Barche impiegate", color: P.accent },
            { value: fornitori.filter(f => fornitoreFilter === "all" || f === fornitoreFilter).length, label: "Fornitori attivi", color: P.orange },
          ].map((c, i) => (
            <div key={i} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "18px 20px", borderLeft: `4px solid ${c.color}` }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
              <p style={{ fontSize: 12, color: P.muted, fontWeight: 500, marginTop: 2 }}>{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Table ── */}
      <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
        {enriched.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: P.muted, fontSize: 15 }}>Nessun risultato per i filtri selezionati</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  {[
                    { key: "data", label: "Data", align: "left" },
                    { key: "tour", label: "Tour", align: "left" },
                    { key: "barca", label: "Barca", align: "left" },
                    { key: "fornitore", label: "Fornitore", align: "left" },
                    { key: "pax", label: "Pax", align: "right" },
                    ...(isCompleto ? [
                      { key: "importo", label: "Importo", align: "right" },
                      { key: "comm", label: "Comm. 18%", align: "right", noSort: true },
                      { key: "saldo", label: "Saldo Fornitore", align: "right", noSort: true },
                    ] : []),
                  ].map((col) => (
                    <th key={col.key} onClick={() => !col.noSort && handleSort(col.key)} style={{
                      textAlign: col.align, padding: "12px 16px", fontWeight: 600, fontSize: 12,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      background: P.headerBg, color: P.muted, borderBottom: `2px solid ${P.border}`,
                      cursor: col.noSort ? "default" : "pointer", userSelect: "none", whiteSpace: "nowrap",
                    }}>
                      {col.label} {!col.noSort && <SortIcon col={col.key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map((r) => (
                  <tr key={r.id} style={{ transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = modeLt}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}` }}>{fmtDate(r.data)}</td>
                    <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}` }}>{r.tour}</td>
                    <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}` }}>{r.barca}</td>
                    <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, fontWeight: 600 }}>{r.fornitore}</td>
                    <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.pax}</td>
                    {isCompleto && <>
                      <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.importo)}</td>
                      <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", color: P.accent }}>{fmt(r.commissione)}</td>
                      <td style={{ padding: "11px 16px", borderBottom: `1px solid ${P.border}`, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmt(r.saldoFornitore)}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg }}>TOTALE</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{totals.pax}</td>
                  {isCompleto && <>
                    <td style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(totals.importo)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg, textAlign: "right", fontVariantNumeric: "tabular-nums", color: P.accent }}>{fmt(totals.commissione)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, borderTop: `2px solid ${modeAccent}`, background: P.headerBg, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(totals.saldoFornitore)}</td>
                  </>}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Completo: Per-supplier financial cards ── */}
      {isCompleto && perFornitore.length > 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>🏢 Riepilogo per fornitore</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 20 }}>
            {perFornitore.map(([name, data]) => (
              <div key={name} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: modeAccent }}>{name}</div>
                {[
                  ["Tour", data.count], ["Passeggeri", data.pax],
                  ["Incassato", fmt(data.importo)],
                  ["Comm. BA", fmt(data.commissione), P.accent],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: P.muted }}>{l}</span>
                    <span style={{ fontWeight: 600, color: c || P.text }}>{v}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${P.border}`, marginTop: 8, paddingTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Saldo da erogare</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: P.accent }}>{fmt(data.saldo)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rotazione: bar chart + distribution cards ── */}
      {!isCompleto && perBarca.length > 0 && (
        <>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>⛵ Impiego barche</div>
            <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
              {perBarca.map(([name, data], i) => {
                const pct = (data.count / maxBarCount) * 100;
                return (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, minWidth: 120, textAlign: "right" }}>{name}</div>
                    <div style={{ flex: 1, height: 26, background: P.bg, borderRadius: 6, overflow: "hidden", position: "relative" }}>
                      <div style={{
                        height: "100%", width: `${pct}%`, background: barColors[i % barColors.length], borderRadius: 6,
                        display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8,
                        fontSize: 11, fontWeight: 700, color: "#fff", transition: "width .4s ease",
                      }}>
                        {pct > 30 && <span>{data.count} tour</span>}
                      </div>
                    </div>
                    {pct <= 30 && <span style={{ fontSize: 12, fontWeight: 600, color: P.text }}>{data.count} tour</span>}
                    <span style={{ fontSize: 11, color: P.muted, minWidth: 60 }}>{data.pax} pax</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>🏢 Distribuzione per fornitore</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {perFornitore.map(([name, data]) => {
                const tourPct = enriched.length > 0 ? ((data.count / enriched.length) * 100).toFixed(0) : 0;
                const paxPct = totals.pax > 0 ? ((data.pax / totals.pax) * 100).toFixed(0) : 0;
                return (
                  <div key={name} style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 20px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: P.rotAccent }}>{name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: P.muted }}>Tour</span>
                      <span style={{ fontWeight: 600 }}>{data.count} <span style={{ color: P.muted, fontWeight: 400 }}>({tourPct}%)</span></span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: P.muted }}>Passeggeri</span>
                      <span style={{ fontWeight: 600 }}>{data.pax} <span style={{ color: P.muted, fontWeight: 400 }}>({paxPct}%)</span></span>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ height: 6, background: P.bg, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${tourPct}%`, background: P.rotAccent, borderRadius: 4, transition: "width .4s" }} />
                      </div>
                      <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>Quota tour: {tourPct}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}