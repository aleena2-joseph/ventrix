import React from 'react';
import Card from '../common/Card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
const sampleData = [
  { time: '08:00', temp: 21.2, pressure: 4.2, health: 95 },
  { time: '10:00', temp: 22.0, pressure: 4.5, health: 93 },
  { time: '12:00', temp: 24.5, pressure: 5.1, health: 88 },
  { time: '14:00', temp: 25.1, pressure: 5.4, health: 84 },
  { time: '16:00', temp: 23.8, pressure: 4.8, health: 89 },
  { time: '18:00', temp: 22.1, pressure: 4.3, health: 92 },
  { time: '20:00', temp: 21.4, pressure: 4.1, health: 94 },
];
export default function TelemetryCard({ title = "LIVE HVAC TELEMETRY & PREDICTIVE TREND" }) {
  return (
    <Card className="col-span-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold text-white uppercase tracking-wider font-['Outfit']">{title}</h3>
          <p className="text-xs text-slate-400">Refrigerant Pressure (Bar) & Ambient Temp (°C) real-time sensor streams</p>
        </div>        
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
            <span className="text-slate-300">Temp (°C)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
            <span className="text-slate-300">Pressure (Bar)</span>
          </div>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sampleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.4)" vertical={false} />
            <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                borderColor: 'rgba(56, 189, 248, 0.3)',
                borderRadius: '12px',
                color: '#f8fafc',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              }}
            />
            <Area type="monotone" dataKey="temp" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#tempGradient)" />
            <Area type="monotone" dataKey="pressure" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#pressureGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}