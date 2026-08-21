import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  ListTodo, 
  Mail, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  User, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Percent,
  Brain,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export default function ActionCards({ actions, meta, onDispatch, isDryRun }) {
  const [expandedComm, setExpandedComm] = useState({});

  const toggleCommExpand = (idx) => {
    setExpandedComm(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Safe color codes mapping based on risk level
  const getRiskColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'MEDIUM':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'LOW':
      case 'SAFE':
      default:
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }
  };

  if (!actions || actions.length === 0) {
    return (
      <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-8 text-center text-zinc-500 glow-indigo">
        <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
        <p className="text-sm font-semibold tracking-wider font-mono text-zinc-400">
          AWAITING ACTION INGESTION
        </p>
        <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
          Perform a voice command, upload an audio file, or click a demo preset to generate actionable operational cards.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* RISK & CONFLICT TELEMETRY BAR */}
      {meta && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 glow-indigo flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-semibold tracking-wider text-zinc-300 font-mono">
                // SYSTEM CONFIDENCE & RISK PROFILE
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Confidence Score Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono text-zinc-400">
                  <span>Understanding Accuracy</span>
                  <span className="text-indigo-400 font-bold">{(meta.confidence_score * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${meta.confidence_score * 100}%` }}
                  />
                </div>
              </div>

              {/* Estimate Execution Time */}
              <div className="flex justify-between items-center bg-zinc-900/50 border border-zinc-800 px-4 py-2 rounded-lg">
                <span className="text-xs font-mono text-zinc-400">Est. Execution Pipeline Latency</span>
                <span className="text-xs font-mono text-cyan-400 font-bold">{meta.estimated_execution_time_ms}ms</span>
              </div>
            </div>

            {/* AI Reasoning Explanation */}
            {meta.risk_reasoning && (
              <div className="flex gap-2 items-start bg-zinc-900/50 border border-zinc-800 px-3 py-2.5 rounded-lg">
                <Brain className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-[9px] text-zinc-500 uppercase tracking-wider font-mono">Why the AI decided this</span>
                  <span className="text-[11px] text-zinc-300 leading-relaxed">{meta.risk_reasoning}</span>
                </div>
              </div>
            )}

            {/* Agent Pipeline Trace */}
            {meta.agent_trace && meta.agent_trace.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono mr-1">Pipeline:</span>
                {meta.agent_trace.map((agent, i) => (
                  <React.Fragment key={i}>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {agent}
                    </span>
                    {i < meta.agent_trace.length - 1 && <span className="text-zinc-700 text-[9px]">→</span>}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Risk Badge */}
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border font-mono text-xs ${getRiskColor(meta.risk_level)}`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div>
                <span className="text-[10px] block opacity-60">RISK METRIC</span>
                <span className="font-bold tracking-wider">{meta.risk_level?.toUpperCase()}</span>
              </div>
            </div>

            {/* Human Review Required Alert */}
            {meta.requires_human_confirmation ? (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
                <div>
                  <span className="text-[10px] block opacity-60">GATEWAY ALERT</span>
                  <span className="font-bold">NEEDS HUMAN CONFIRMATION</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <div>
                  <span className="text-[10px] block opacity-60">GATEWAY STATE</span>
                  <span className="font-bold">SAFE (AUTO-APPROVE)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCHEDULE CONFLICT DETAILS ALERT */}
      {meta?.schedule_conflicts && meta.schedule_conflicts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 flex gap-3 items-start font-mono text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold tracking-wider">CONFLICT DETECTION ALERT</span>
            <ul className="list-disc pl-4 space-y-1 mt-1 text-red-400">
              {meta.schedule_conflicts.map((conflict, idx) => (
                <li key={idx}>{conflict}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* INTERACTIVE CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {actions.map((action, index) => {
            const isCalendar = action.type === 'calendar';
            const isTask = action.type === 'task';
            const isComm = action.type === 'communication';

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`bg-zinc-950 border rounded-xl overflow-hidden shadow-lg flex flex-col justify-between min-h-[220px] transition-all hover:translate-y-[-2px] ${
                  isCalendar 
                    ? 'border-cyan-500/20 hover:border-cyan-500/40 glow-cyan' 
                    : isTask 
                    ? 'border-amber-500/20 hover:border-amber-500/40 glow-amber' 
                    : 'border-emerald-500/20 hover:border-emerald-500/40 glow-emerald'
                }`}
              >
                {/* Header */}
                <div className={`px-4 py-3.5 border-b flex items-center justify-between ${
                  isCalendar 
                    ? 'bg-cyan-500/5 border-cyan-500/20' 
                    : isTask 
                    ? 'bg-amber-500/5 border-amber-500/20' 
                    : 'bg-emerald-500/5 border-emerald-500/20'
                }`}>
                  <div className="flex items-center gap-2">
                    {isCalendar && <Calendar className="w-4 h-4 text-cyan-400" />}
                    {isTask && <ListTodo className="w-4 h-4 text-amber-400" />}
                    {isComm && (action.channel === 'slack' ? <MessageSquare className="w-4 h-4 text-emerald-400" /> : <Mail className="w-4 h-4 text-emerald-400" />)}
                    <span className="text-[10px] font-bold tracking-widest font-mono text-zinc-300 uppercase">
                      {action.type}
                    </span>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    isCalendar 
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                      : isTask 
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {isCalendar && 'SCHEDULING'}
                    {isTask && 'TRELLO'}
                    {isComm && (action.channel?.toUpperCase() || 'EMAIL')}
                  </span>
                </div>

                {/* Body Content */}
                <div className="p-4 flex-1 flex flex-col justify-between text-xs space-y-4">
                  {/* CALENDAR VIEW */}
                  {isCalendar && (
                    <div className="space-y-3 font-sans">
                      <h4 className="font-bold text-zinc-100 text-sm leading-tight">{action.title}</h4>
                      <div className="space-y-2 text-zinc-400 font-mono text-[11px]">
                        <div className="flex items-center gap-2 bg-zinc-900/60 p-2 rounded border border-zinc-800/80">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <div>
                            <span className="block text-[9px] text-zinc-500">START TIME</span>
                            <span>{new Date(action.start_time).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-zinc-900/60 p-2 rounded border border-zinc-800/80">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          <div>
                            <span className="block text-[9px] text-zinc-500">DURATION</span>
                            <span>{action.duration_minutes} Minutes</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TASK VIEW */}
                  {isTask && (
                    <div className="space-y-3 font-sans">
                      <h4 className="font-bold text-zinc-100 text-sm leading-tight">{action.title}</h4>
                      <div className="space-y-2 text-zinc-400 font-mono text-[11px]">
                        <div className="flex justify-between items-center bg-zinc-900/60 px-3 py-2 rounded border border-zinc-800/80">
                          <span className="text-[9px] text-zinc-500 uppercase">Board Target</span>
                          <span className="text-zinc-200 font-bold">{action.board}</span>
                        </div>
                        <div className="flex justify-between items-center bg-zinc-900/60 px-3 py-2 rounded border border-zinc-800/80">
                          <span className="text-[9px] text-zinc-500 uppercase">Priority Rating</span>
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            action.priority?.toLowerCase() === 'high' 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                              : action.priority?.toLowerCase() === 'medium'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {action.priority?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* COMMUNICATION VIEW */}
                  {isComm && (
                    <div className="space-y-2 font-sans">
                      <div className="space-y-1">
                        <div className="flex justify-between text-zinc-300 font-medium">
                          <span className="text-[11px] truncate font-mono">
                            <span className="text-zinc-500 font-bold">TO:</span> {action.recipient}
                          </span>
                        </div>
                        <h4 className="font-semibold text-zinc-100 text-xs truncate leading-tight">
                          <span className="text-zinc-500 font-mono font-bold">SUBJ:</span> {action.subject}
                        </h4>
                      </div>

                      {/* Expandable Draft Body */}
                      <div className="rounded border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                        <button
                          onClick={() => toggleCommExpand(index)}
                          className="w-full px-2.5 py-1.5 bg-zinc-900/60 flex items-center justify-between text-zinc-400 hover:text-zinc-300 cursor-pointer"
                        >
                          <span className="text-[10px] font-mono uppercase">Draft Message Body</span>
                          {expandedComm[index] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        
                        <div className={`transition-all duration-300 ${expandedComm[index] ? 'max-h-[140px] p-2.5 overflow-y-auto border-t border-zinc-800' : 'max-h-0'}`}>
                          <p className="text-[11px] text-zinc-400 leading-relaxed font-sans whitespace-pre-wrap">
                            {action.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Per-Action Explanation */}
                  {action.reasoning && (
                    <div className="flex gap-2 items-start bg-zinc-900/40 border border-zinc-800/80 rounded p-2.5">
                      {action.rescheduled ? (
                        <RefreshCw className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                      )}
                      <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                        {action.reasoning}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Action Confirmations */}
                <div className="px-4 py-3 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between text-zinc-500 text-[10px] font-mono">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-zinc-500" />
                    <span>VERIFIED</span>
                  </div>
                  {isCalendar && (
                    <span className="text-cyan-500/80 hover:text-cyan-400 flex items-center gap-1 cursor-pointer">
                      GCal Integration <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  )}
                  {isTask && (
                    <span className="text-amber-500/80 hover:text-amber-400 flex items-center gap-1">
                      Trello Board Sync
                    </span>
                  )}
                  {isComm && (
                    <span className="text-emerald-500/80 hover:text-emerald-400 flex items-center gap-1">
                      {action.channel === 'slack' ? 'Slack Target' : 'SMTP Relay'}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* DISPATCH ACTION TRIGGER BUTTON */}
      <div className="flex justify-end pt-4">
        <button
          onClick={onDispatch}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg border font-mono text-sm font-bold tracking-wider transition shadow-lg cursor-pointer ${
            isDryRun
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 glow-amber'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 glow-emerald'
          }`}
        >
          {isDryRun ? 'EXECUTE DRY-RUN SIMULATION' : 'CONFIRM & EXECUTE LIVE PIPELINE'}
        </button>
      </div>

    </div>
  );
}
