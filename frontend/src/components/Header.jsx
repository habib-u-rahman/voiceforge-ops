import React from 'react';
import { Cpu, Wifi, ShieldAlert, History, Activity, Zap } from 'lucide-react';

export default function Header({ 
  isDryRun, 
  setIsDryRun, 
  latency, 
  onOpenHistory, 
  isBackendConnected 
}) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 glow-indigo">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        {/* Title & Brand */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            {isBackendConnected && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-zinc-100 m-0 font-sans flex items-center gap-2">
              VOICEFORGE OPS <span className="text-indigo-500 font-mono text-sm tracking-widest">// MISSION CONTROL</span>
            </h1>
            <p className="text-xs text-zinc-400 font-mono">Autonomous AI Executive Agent System</p>
          </div>
        </div>

        {/* Live Telemetry Info */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          
          {/* LPU Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-zinc-300">GROQ LPU:</span>
            <span className="text-emerald-400 font-semibold">ACTIVE (SUB-500MS)</span>
          </div>

          {/* Latency Meter */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-zinc-300">LATENCY:</span>
            <span className="text-cyan-400 font-semibold">{latency ? `${latency}ms` : 'IDLE'}</span>
          </div>

          {/* Simulation / Live Execution Toggle */}
          <div className="flex items-center gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
            <button
              onClick={() => setIsDryRun(true)}
              className={`px-3 py-1 rounded text-xs transition cursor-pointer ${
                isDryRun
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              DRY-RUN
            </button>
            <button
              onClick={() => setIsDryRun(false)}
              className={`px-3 py-1 rounded text-xs transition cursor-pointer ${
                !isDryRun
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              LIVE DISPATCH
            </button>
          </div>

          {/* History Drawer Trigger */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>AUDIT LOG</span>
          </button>
        </div>

      </div>
    </header>
  );
}
