import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ComposedChart, Scatter
} from "recharts";

// ─── Synthetic Data ───────────────────────────────────────────────
const generateDailyData = () => {
  const days = [];
  let cumulative = 0;
  const labels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  for (let i = 0; i < 60; i++) {
    const profit = (Math.random() - 0.42) * 4800;
    const maxProfit = Math.abs(profit) + Math.random() * 2000;
    const maxLoss = profit < 0 ? profit - Math.random() * 1200 : -(Math.random() * 800);
    cumulative += profit;
    const month = labels[Math.floor(i / 5) % 12];
    days.push({
      day: i + 1,
      label: `${month} ${(i % 28) + 1}`,
      profit: Math.round(profit),
      maxProfit: Math.round(maxProfit),
      maxLoss: Math.round(maxLoss),
      cumulative: Math.round(cumulative),
      volume: Math.round(Math.random() * 500 + 100),
      winRate: Math.round(Math.random() * 40 + 50),
      sharpe: +(Math.random() * 2 + 0.5).toFixed(2),
    });
  }
  return days;
};

const ASSET_TYPES = ["Options"];
const TIME_RANGES = ["7D", "14D", "30D", "60D"];

const allData = generateDailyData();

// ─── Custom Tooltip ────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(10,12,20,0.95)",
      border: "1px solid rgba(255,200,50,0.3)",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 12,
      color: "#e8e0cc",
      backdropFilter: "blur(8px)",
    }}>
      <p style={{ color: "#ffd166", fontWeight: 700, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "#e8e0cc" }}>
          {p.name}: <span style={{ fontWeight: 700 }}>${p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Metric Card ───────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, color, icon, trend }) => (
  <div style={{
    background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
    border: `1px solid ${color}30`,
    borderRadius: 14,
    padding: "20px 24px",
    position: "relative",
    overflow: "hidden",
  }}>
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 2,
      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
    }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <p style={{ color: "#7a8190", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{label}</p>
        <p style={{ color, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", fontFamily: "'DM Mono', monospace" }}>{value}</p>
        {sub && <p style={{ color: "#555e70", fontSize: 11, marginTop: 4 }}>{sub}</p>}
      </div>
      <div style={{ fontSize: 22, opacity: 0.6 }}>{icon}</div>
    </div>
    {trend !== undefined && (
      <div style={{
        marginTop: 12,
        display: "flex", alignItems: "center", gap: 4,
        color: trend >= 0 ? "#06d6a0" : "#ef476f",
        fontSize: 12, fontWeight: 600,
      }}>
        {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs last period
      </div>
    )}
  </div>
);

// ─── Section Header ────────────────────────────────────────────────
const SectionHeader = ({ title, accent }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
    <div style={{ width: 4, height: 22, background: accent, borderRadius: 2 }} />
    <h2 style={{ color: "#e8e0cc", fontSize: 15, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>{title}</h2>
  </div>
);

// ─── Filter Bar ────────────────────────────────────────────────────
const FilterBar = ({ options, selected, onChange, label }) => (
  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
    <span style={{ color: "#555e70", fontSize: 11, alignSelf: "center", marginRight: 4 }}>{label}:</span>
    {options.map(opt => (
      <button
        key={opt}
        onClick={() => onChange(opt)}
        style={{
          background: selected === opt ? "rgba(255,209,102,0.15)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${selected === opt ? "#ffd166" : "rgba(255,255,255,0.07)"}`,
          borderRadius: 6,
          color: selected === opt ? "#ffd166" : "#7a8190",
          fontSize: 11,
          fontWeight: selected === opt ? 700 : 400,
          padding: "5px 12px",
          cursor: "pointer",
          transition: "all 0.15s",
          letterSpacing: "0.06em",
        }}
      >{opt}</button>
    ))}
  </div>
);

// ─── Main Dashboard ────────────────────────────────────────────────
export default function TradingDashboard() {
  const [timeRange, setTimeRange] = useState("30D");
  const [assetFilter, setAssetFilter] = useState("Options");
  const [activeTab, setActiveTab] = useState("overview");

  const days = { "7D": 7, "14D": 14, "30D": 30, "60D": 60 }[timeRange];
  const data = allData.slice(-days);

  const totalProfit = data.reduce((s, d) => s + d.profit, 0);
  const maxProfitDay = Math.max(...data.map(d => d.maxProfit));
  const maxLossDay = Math.min(...data.map(d => d.maxLoss));
  const avgWinRate = Math.round(data.reduce((s, d) => s + d.winRate, 0) / data.length);
  const avgSharpe = (data.reduce((s, d) => s + d.sharpe, 0) / data.length).toFixed(2);
  const winDays = data.filter(d => d.profit > 0).length;
  const avgDailyProfit = Math.round(totalProfit / data.length);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "maxloss", label: "Max Loss" },
    { id: "maxprofit", label: "Max Profit" },
    { id: "daily", label: "Daily P&L" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080b14",
      fontFamily: "'Syne', 'DM Sans', sans-serif",
      color: "#e8e0cc",
      position: "relative",
      overflowX: "hidden",
    }}>
      {/* Ambient background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 60% 40% at 15% 20%, rgba(255,209,102,0.04) 0%, transparent 70%),
          radial-gradient(ellipse 40% 60% at 85% 80%, rgba(6,214,160,0.03) 0%, transparent 70%)
        `,
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "0 24px 60px" }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "28px 0 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 28,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #ffd166, #ef8c3a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 900,
            }}>⬡</div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em", color: "#f5ead8" }}>
                APEX<span style={{ color: "#ffd166" }}>TRADE</span>
              </h1>
              <p style={{ fontSize: 10, color: "#555e70", letterSpacing: "0.1em" }}>PERFORMANCE ANALYTICS</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              background: "rgba(6,214,160,0.1)", border: "1px solid rgba(6,214,160,0.3)",
              borderRadius: 20, padding: "5px 14px",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, color: "#06d6a0", fontWeight: 600,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#06d6a0", display: "inline-block", animation: "pulse 2s infinite" }} />
              LIVE
            </div>
            <div style={{ color: "#555e70", fontSize: 12 }}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* ── Global Filters ── */}
        <div style={{ display: "flex", gap: 20, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
          <FilterBar options={TIME_RANGES} selected={timeRange} onChange={setTimeRange} label="Range" />
        </div>

        {/* ── KPI Row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 36 }}>
          <MetricCard
            label="Total P&L"
            value={`${totalProfit >= 0 ? "+" : ""}$${Math.abs(totalProfit).toLocaleString()}`}
            sub={`${timeRange} period`}
            color={totalProfit >= 0 ? "#06d6a0" : "#ef476f"}
            icon="◈"
            trend={11.4}
          />
          <MetricCard
            label="Peak Daily Gain"
            value={`+$${maxProfitDay.toLocaleString()}`}
            sub="Single session record"
            color="#ffd166"
            icon="▲"
            trend={5.2}
          />
          <MetricCard
            label="Max Drawdown"
            value={`-$${Math.abs(maxLossDay).toLocaleString()}`}
            sub="Worst session"
            color="#ef476f"
            icon="▼"
            trend={-3.1}
          />
          <MetricCard
            label="Win Rate"
            value={`${avgWinRate}%`}
            sub={`${winDays}/${data.length} trading days`}
            color="#a78bfa"
            icon="◎"
            trend={2.8}
          />
          <MetricCard
            label="Sharpe Ratio"
            value={avgSharpe}
            sub="Risk-adjusted return"
            color="#38bdf8"
            icon="⧖"
            trend={0.6}
          />
          <MetricCard
            label="Avg Daily P&L"
            value={`${avgDailyProfit >= 0 ? "+" : ""}$${Math.abs(avgDailyProfit).toLocaleString()}`}
            sub="Mean daily performance"
            color={avgDailyProfit >= 0 ? "#06d6a0" : "#ef476f"}
            icon="≋"
          />
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 2, marginBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "10px 20px",
              color: activeTab === t.id ? "#ffd166" : "#7a8190",
              fontSize: 12, fontWeight: activeTab === t.id ? 700 : 400,
              letterSpacing: "0.08em", textTransform: "uppercase",
              borderBottom: `2px solid ${activeTab === t.id ? "#ffd166" : "transparent"}`,
              transition: "all 0.15s",
              marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Cumulative PnL */}
            <div style={{
              gridColumn: "1 / -1",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Cumulative P&L Curve" accent="#ffd166" />
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffd166" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ffd166" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555e70", fontSize: 10 }} interval={Math.floor(data.length / 8)} />
                  <YAxis tick={{ fill: "#555e70", fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="cumulative" name="Cumulative P&L" stroke="#ffd166" fill="url(#cumulGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Profit Bar */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Daily P&L Distribution" accent="#06d6a0" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555e70", fontSize: 9 }} interval={Math.floor(data.length / 6)} />
                  <YAxis tick={{ fill: "#555e70", fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                  <Bar dataKey="profit" name="Daily P&L"
                    fill="#06d6a0"
                    radius={[3, 3, 0, 0]}
                    label={false}
                  >
                    {data.map((entry, i) => (
                      <rect key={i} fill={entry.profit >= 0 ? "#06d6a0" : "#ef476f"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Win Rate Trend */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Win Rate & Sharpe Trend" accent="#a78bfa" />
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555e70", fontSize: 9 }} interval={Math.floor(data.length / 6)} />
                  <YAxis yAxisId="left" tick={{ fill: "#555e70", fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#555e70", fontSize: 10 }} domain={[0, 4]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar yAxisId="left" dataKey="winRate" name="Win Rate %" fill="rgba(167,139,250,0.3)" radius={[2, 2, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="sharpe" name="Sharpe" stroke="#38bdf8" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── MAX LOSS TAB ── */}
        {activeTab === "maxloss" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{
              gridColumn: "1 / -1",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(239,71,111,0.15)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Maximum Loss Per Session" accent="#ef476f" />
              <p style={{ color: "#555e70", fontSize: 12, marginBottom: 16 }}>
                Max loss = lowest intra-session mark-to-market trough relative to session open. Calculated as: <code style={{ color: "#ef8c3a", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>min(entry − worst_price) × position_size</code>
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef476f" stopOpacity={0} />
                      <stop offset="100%" stopColor="#ef476f" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555e70", fontSize: 10 }} interval={Math.floor(data.length / 8)} />
                  <YAxis tick={{ fill: "#555e70", fontSize: 10 }} tickFormatter={v => `$${v.toLocaleString()}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="maxLoss" name="Max Loss" stroke="#ef476f" fill="url(#lossGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Loss Magnitude Buckets" accent="#ef476f" />
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                {[
                  { label: "< $500", count: data.filter(d => Math.abs(d.maxLoss) < 500).length, color: "#ffd166" },
                  { label: "$500–$1,500", count: data.filter(d => Math.abs(d.maxLoss) >= 500 && Math.abs(d.maxLoss) < 1500).length, color: "#ef8c3a" },
                  { label: "$1,500–$3,000", count: data.filter(d => Math.abs(d.maxLoss) >= 1500 && Math.abs(d.maxLoss) < 3000).length, color: "#ef476f" },
                  { label: "> $3,000", count: data.filter(d => Math.abs(d.maxLoss) >= 3000).length, color: "#9f1239" },
                ].map(({ label, count, color }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#9aa0ac" }}>{label}</span>
                      <span style={{ fontSize: 12, color, fontWeight: 700 }}>{count} days</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 6 }}>
                      <div style={{ background: color, width: `${(count / data.length) * 100}%`, height: "100%", borderRadius: 4, transition: "width 0.5s" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Risk Metrics Summary" accent="#ef476f" />
              {[
                { label: "Average Max Loss", value: `$${Math.round(data.reduce((s, d) => s + Math.abs(d.maxLoss), 0) / data.length).toLocaleString()}` },
                { label: "Worst Single Day", value: `$${Math.abs(maxLossDay).toLocaleString()}` },
                { label: "Loss-to-Profit Ratio", value: `${(Math.abs(maxLossDay) / maxProfitDay).toFixed(2)}x` },
                { label: "Days Exceeding $2K Loss", value: `${data.filter(d => Math.abs(d.maxLoss) > 2000).length}` },
                { label: "Max Consecutive Loss Days", value: (() => {
                  let max = 0, cur = 0;
                  data.forEach(d => { if (d.profit < 0) { cur++; max = Math.max(max, cur); } else cur = 0; });
                  return max;
                })() },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <span style={{ fontSize: 12, color: "#7a8190" }}>{label}</span>
                  <span style={{ fontSize: 13, color: "#ef476f", fontWeight: 700, fontFamily: "monospace" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MAX PROFIT TAB ── */}
        {activeTab === "maxprofit" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{
              gridColumn: "1 / -1",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,209,102,0.12)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Maximum Profit Potential Per Session" accent="#ffd166" />
              <p style={{ color: "#555e70", fontSize: 12, marginBottom: 16 }}>
                Max profit = highest intra-session mark-to-market peak. Formula: <code style={{ color: "#06d6a0", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>max(best_price − entry) × position_size</code>. Compares realized vs unrealized peak.
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data}>
                  <defs>
                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffd166" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#ffd166" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555e70", fontSize: 10 }} interval={Math.floor(data.length / 8)} />
                  <YAxis tick={{ fill: "#555e70", fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="maxProfit" name="Max Profit Potential" stroke="#ffd166" fill="url(#profGrad)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="profit" name="Realized P&L" stroke="#06d6a0" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Profit Capture Efficiency" accent="#06d6a0" />
              <p style={{ color: "#7a8190", fontSize: 11, marginBottom: 16 }}>Realized / Max Potential — how much available profit was captured</p>
              {data.slice(-10).reverse().map((d, i) => {
                const eff = Math.min(100, Math.round((d.profit / d.maxProfit) * 100));
                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: "#7a8190" }}>{d.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: eff >= 70 ? "#06d6a0" : eff >= 40 ? "#ffd166" : "#ef476f" }}>{Math.max(0, eff)}%</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 5 }}>
                      <div style={{
                        width: `${Math.max(0, eff)}%`, height: "100%", borderRadius: 4,
                        background: eff >= 70 ? "#06d6a0" : eff >= 40 ? "#ffd166" : "#ef476f",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Profit Tier Breakdown" accent="#ffd166" />
              {[
                { label: "$0–$1,000", count: data.filter(d => d.maxProfit >= 0 && d.maxProfit < 1000).length, color: "#7a8190" },
                { label: "$1,000–$2,500", count: data.filter(d => d.maxProfit >= 1000 && d.maxProfit < 2500).length, color: "#ffd166" },
                { label: "$2,500–$4,000", count: data.filter(d => d.maxProfit >= 2500 && d.maxProfit < 4000).length, color: "#ef8c3a" },
                { label: "> $4,000", count: data.filter(d => d.maxProfit >= 4000).length, color: "#06d6a0" },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#9aa0ac" }}>{label}</span>
                      <span style={{ fontSize: 12, color, fontWeight: 700 }}>{count} sessions</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 6 }}>
                      <div style={{ background: color, width: `${(count / data.length) * 100}%`, height: "100%", borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DAILY P&L TAB ── */}
        {activeTab === "daily" && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Total Profit Over Trading Days" accent="#38bdf8" />
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data}>
                  <defs>
                    <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555e70", fontSize: 10 }} interval={Math.floor(data.length / 8)} />
                  <YAxis yAxisId="bar" tick={{ fill: "#555e70", fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                  <YAxis yAxisId="line" orientation="right" tick={{ fill: "#555e70", fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine yAxisId="bar" y={0} stroke="rgba(255,255,255,0.12)" />
                  <Bar yAxisId="bar" dataKey="profit" name="Daily P&L"
                    radius={[3, 3, 0, 0]}
                    fill="#06d6a0"
                  />
                  <Line yAxisId="line" type="monotone" dataKey="cumulative" name="Cumulative" stroke="#38bdf8" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Log Table */}
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 24,
              maxHeight: 360, overflowY: "auto",
            }}>
              <SectionHeader title="Session Log" accent="#38bdf8" />
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    {["Date", "P&L", "Win%"].map(h => (
                      <th key={h} style={{ color: "#555e70", fontWeight: 600, padding: "4px 6px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.05)", letterSpacing: "0.06em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice().reverse().map((d, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "7px 6px", color: "#7a8190" }}>{d.label}</td>
                      <td style={{ padding: "7px 6px", color: d.profit >= 0 ? "#06d6a0" : "#ef476f", fontWeight: 700, fontFamily: "monospace" }}>
                        {d.profit >= 0 ? "+" : ""}${d.profit.toLocaleString()}
                      </td>
                      <td style={{ padding: "7px 6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 4, width: 40 }}>
                            <div style={{ background: d.winRate >= 60 ? "#06d6a0" : d.winRate >= 45 ? "#ffd166" : "#ef476f", width: `${d.winRate}%`, height: "100%", borderRadius: 3 }} />
                          </div>
                          <span style={{ color: "#9aa0ac" }}>{d.winRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Historical Average Comparison */}
            <div style={{
              gridColumn: "1 / -1",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 24,
            }}>
              <SectionHeader title="Daily P&L vs 30-Day Rolling Average" accent="#a78bfa" />
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={data.map((d, i, arr) => {
                  const window = arr.slice(Math.max(0, i - 29), i + 1);
                  const avg = Math.round(window.reduce((s, x) => s + x.profit, 0) / window.length);
                  return { ...d, rollingAvg: avg };
                })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555e70", fontSize: 10 }} interval={Math.floor(data.length / 8)} />
                  <YAxis tick={{ fill: "#555e70", fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                  <Bar dataKey="profit" name="Daily P&L" fill="rgba(167,139,250,0.25)" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="rollingAvg" name="30-Day Avg" stroke="#a78bfa" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{
          marginTop: 40, paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 8,
        }}>
          <p style={{ color: "#3a3f4a", fontSize: 10, letterSpacing: "0.06em" }}>
            APEX TRADE ANALYTICS · DATA REFRESHED EVERY 15s IN LIVE MODE
          </p>
          <p style={{ color: "#3a3f4a", fontSize: 10 }}>
            Metrics: Max Loss · Max Profit · Daily P&L · Win Rate · Sharpe · Capture Efficiency
          </p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Mono:wght@400;500&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
}
