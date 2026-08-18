import React from 'react';
import Card from '../common/Card';
import { Thermometer, Activity, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
export default function HealthCard({ hvacUnit }) {
  const { id, car, status, health, temp, vibration, rul } = hvacUnit;
  const getStatusBadge = (st) => {
    switch (st) {
      case 'Optimal':
        return <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30"><CheckCircle2 className="w-3.5 h-3.5" /> Optimal</span>;
      case 'Warning':
        return <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30"><AlertTriangle className="w-3.5 h-3.5" /> Warning</span>;
      case 'Critical':
        return <span className="flex items-center gap-1 text-xs text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/30"><AlertTriangle className="w-3.5 h-3.5" /> Critical</span>;
      default:
        return null;
    }
  };
  const getHealthColor = (h) => {   
   if (h >= 85) return 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
    if (h >= 60) return 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
    return 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]';
  };
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-lg font-bold text-white tracking-wide font-['Outfit']">{id}</span>
            <p className="text-xs text-slate-400">{car}</p>
          </div>
          {getStatusBadge(status)}
        </div>
        {/* Health Index Bar */}
        <div className="mt-4 mb-4">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-400 uppercase tracking-wider">Health Index</span>
            <span className="text-cyan-300 font-mono">{health}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden p-0.5 border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getHealthColor(health)}`}
              style={{ width: `${health}%` }}
            />
          </div>
        </div>
        {/* Metrics breakdown */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex flex-col">
            <span className="text-slate-400 flex items-center gap-1"><Thermometer className="w-3 h-3 text-cyan-400" /> Temp</span>
            <span className="font-semibold text-slate-100 mt-0.5 font-mono">{temp}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 flex items-center gap-1"><Activity className="w-3 h-3 text-cyan-400" /> Vibr.</span>
            <span className="font-semibold text-slate-100 mt-0.5 font-mono">{vibration}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3 text-cyan-400" /> Est. RUL</span>
            <span className="font-semibold text-cyan-300 mt-0.5 font-mono">{rul}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
