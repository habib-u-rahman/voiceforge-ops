import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Trash2, Shield, Calendar, ListTodo, Mail, MessageSquare, Activity } from 'lucide-react';

export default function HistoryDrawer({ isOpen, onClose, historyLogs, onClearHistory }) {
  
  // Calculate simulated time saved: 15 mins per email, 10 mins per task, 10 mins per calendar invite
  const calculateTimeSaved = () => {
    let totalMinutes = 0;
    historyLogs.forEach(log => {
      const actionsCount = log.actions_count || log.payload?.length || 0;
      totalMinutes += actionsCount * 12.5; // average 12.5 minutes saved per action
    });
    return totalMinutes.toFixed(1);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50 cursor-pointer"
          />

          {/* Slide-over Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[440px] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col font-sans"
          >
            {/* Header */}
            <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-sm font-bold tracking-wider text-zinc-100 font-mono">
                    // AUDIT LOG PIPELINE
                  </h2>
                  <p className="text-[10px] text-zinc-500 font-mono">Execution History Logs</p>
                </div>
              </div>
              
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Time Saved Metrics Panel */}
            <div className="p-5 bg-indigo-500/5 border-b border-zinc-800/60 font-mono text-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 block uppercase">Total Executive Efficiency Boost</span>
                <span className="text-indigo-400 font-bold text-lg flex items-center gap-1.5">
                  <Clock className="w-5 h-5" />
                  {calculateTimeSaved()} Mins Saved
                </span>
              </div>
              
              {historyLogs.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="text-[10px]">CLEAR</span>
                </button>
              )}
            </div>

            {/* Scrolling Audit Log List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {historyLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 font-mono">
                  <Activity className="w-8 h-8 text-zinc-700 mb-2 animate-pulse" />
                  <p className="text-xs">No execution history recorded.</p>
                  <p className="text-[10px] mt-1 opacity-70">Dispatched tasks will appear here.</p>
                </div>
              ) : (
                historyLogs.map((log, index) => (
                  <div 
                    key={log.id || index}
                    className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 space-y-3 font-mono text-[11px]"
                  >
                    {/* Log Card Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                      <span className={`font-bold px-2 py-0.5 rounded text-[9px] uppercase ${
                        log.status === 'dispatched' || log.status === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {log.status || 'SUCCESS'}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Recent'}
                      </span>
                    </div>

                    {/* Summary */}
                    <div className="space-y-1 font-sans text-xs">
                      <span className="block font-mono text-[10px] text-zinc-500 font-semibold uppercase">EXECUTIVE SUMMARY</span>
                      <p className="text-zinc-300 leading-normal">{log.summary}</p>
                    </div>

                    {/* Sub-actions checklist */}
                    {log.payload && (
                      <div className="space-y-1.5 pt-1">
                        <span className="block text-[10px] text-zinc-500 font-semibold uppercase">DISPATCHED CARDS</span>
                        <div className="space-y-1">
                          {log.payload.map((action, idx) => {
                            const isCal = action.type === 'calendar';
                            const isTask = action.type === 'task';
                            const isComm = action.type === 'communication';
                            return (
                              <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-zinc-900/60 border border-zinc-800/50">
                                <div className="flex items-center gap-1.5">
                                  {isCal && <Calendar className="w-3.5 h-3.5 text-cyan-400" />}
                                  {isTask && <ListTodo className="w-3.5 h-3.5 text-amber-400" />}
                                  {isComm && (action.channel === 'slack' ? <MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Mail className="w-3.5 h-3.5 text-emerald-400" />)}
                                  <span className="text-zinc-300 font-sans text-xs truncate max-w-[200px]">{action.title || action.subject || 'Action Card'}</span>
                                </div>
                                <span className="text-[8px] bg-zinc-800 px-1 rounded text-zinc-500 font-bold tracking-wider uppercase">{action.type}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
