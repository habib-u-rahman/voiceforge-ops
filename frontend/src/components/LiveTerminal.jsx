import React, { useEffect, useRef } from 'react';
import { Terminal, Shield } from 'lucide-react';

export default function LiveTerminal({ logs, transcript, isProcessing }) {
  const terminalEndRef = useRef(null);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* MONOSPACE TERMINAL VIEW */}
      <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-5 glow-indigo flex flex-col min-h-[300px]">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400" />
            <h2 className="text-xs font-semibold tracking-wider text-zinc-300 font-mono">
              // AUTONOMOUS AGENT REASONING STREAM
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
            <span className="text-[10px] text-zinc-500 font-mono">SSE.STREAM_READY</span>
          </div>
        </div>

        {/* Scrolling logs content */}
        <div className="flex-1 overflow-y-auto max-h-[220px] font-terminal text-xs text-zinc-300 space-y-1.5 pr-2">
          {logs.length === 0 ? (
            <div className="text-zinc-600 italic font-mono select-none">
              &gt; Agent idle. Awaiting transcript trigger...
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                className={`transition-all duration-300 ${
                  log.includes('ERROR') || log.includes('failed')
                    ? 'text-red-400 font-semibold'
                    : log.includes('Risk assessment') || log.includes('Confidence')
                    ? 'text-amber-400'
                    : log.includes('Successfully') || log.includes('dispatched')
                    ? 'text-emerald-400'
                    : 'text-zinc-300'
                }`}
              >
                &gt; {log}
              </div>
            ))
          )}
          {isProcessing && (
            <div className="text-indigo-400 font-mono animate-pulse">
              &gt; Reasoning in progress...<span className="inline-block w-1.5 h-3.5 bg-indigo-400 ml-1 align-middle"></span>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* RAW TRANSCRIPT PREVIEW */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 backdrop-blur-md flex flex-col justify-between glow-indigo">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-zinc-400" />
            <h2 className="text-xs font-semibold tracking-wider text-zinc-300 font-mono">
              // CAPTURED TRANSCRIPT
            </h2>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            This represents the raw text ingested by LLaMA 3.3 for operational logic translation.
          </p>
        </div>

        <div className="flex-1 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3.5 min-h-[120px] max-h-[160px] overflow-y-auto">
          {transcript ? (
            <p className="text-xs text-zinc-300 leading-relaxed font-sans select-all">
              "{transcript}"
            </p>
          ) : (
            <p className="text-xs text-zinc-600 italic font-mono">
              Awaiting captured audio transcription...
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
