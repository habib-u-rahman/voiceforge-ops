import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import Header from './components/Header';
import AudioInput from './components/AudioInput';
import LiveTerminal from './components/LiveTerminal';
import ActionCards from './components/ActionCards';
import HistoryDrawer from './components/HistoryDrawer';
import { ShieldCheck, Activity, HelpCircle } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  const [isDryRun, setIsDryRun] = useState(true);
  const [latency, setLatency] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [transcript, setTranscript] = useState('');
  const [actions, setActions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Check connection to FastAPI backend on load
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`${API_BASE}/`);
        if (response.ok) {
          setIsBackendConnected(true);
          console.log("Connected to FastAPI backend.");
        } else {
          setIsBackendConnected(false);
        }
      } catch (e) {
        setIsBackendConnected(false);
        console.warn("FastAPI backend is offline. Operating in local simulation mode.");
      }
    };
    checkConnection();
    
    // Load local history logs
    const savedHistory = localStorage.getItem('voiceforge_history');
    if (savedHistory) {
      setHistoryLogs(JSON.parse(savedHistory));
    }
  }, []);

  // Helper to add simulated agent reasoning steps in the terminal view
  const writeSimulatedLogs = async (steps, delay = 800) => {
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, delay));
      setLogs(prev => [...prev, steps[i]]);
    }
  };

  // Handler for text inputs (presets)
  const handleProcessText = async (text) => {
    setIsProcessing(true);
    setTranscript(text);
    setLogs([]);
    setActions([]);
    setMeta(null);

    const startTime = performance.now();
    setLogs(prev => [...prev, "[00:00.00] Initializing multi-intent parser..."]);

    if (isBackendConnected) {
      try {
        // Step 1: Reason and parse action payload
        setLogs(prev => [...prev, "[00:00.15] Querying LLaMA 3.3 for operational actions..."]);
        const response = await fetch(`${API_BASE}/api/parse-actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        
        if (!response.ok) throw new Error("Failed to parse actions from backend.");
        const result = await response.json();

        // Step 2: Log assessment telemetry
        const duration = Math.round(performance.now() - startTime);
        setLatency(duration);
        
        setLogs(prev => [
          ...prev, 
          `[00:00.32] Confidence: ${(result.meta.confidence_score * 100).toFixed(1)}% | Risk Level: ${result.meta.risk_level}`,
          `[00:00.35] Actions extracted: ${result.actions.length} intents detected.`,
          `[00:00.38] Conflict Check: ${result.meta.schedule_conflicts.length} overlaps found.`
        ]);

        setActions(result.actions);
        setMeta(result.meta);
        toast.success("AI actions parsed successfully!");

      } catch (err) {
        console.error(err);
        setLogs(prev => [...prev, `[ERROR] Ingestion failed: ${err.message}`]);
        toast.error("Failed to connect to parser.");
        runMockSimulation(text);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Offline fallback
      await writeSimulatedLogs([
        "[00:00.22] Querying LLaMA 3.3 (offline simulation)...",
        "[00:00.52] Conflict Analyzer: Scanning calendar and contacts database...",
        "[00:00.75] Risk rating: LOW | Confidence Score: 98.2%",
      ], 500);
      runMockSimulation(text);
    }
  };

  // Handler for audio files (Microphone recording & file drops)
  const handleProcessAudioFile = async (file) => {
    setIsProcessing(true);
    setTranscript('');
    setLogs([]);
    setActions([]);
    setMeta(null);

    const startTime = performance.now();
    setLogs(prev => [...prev, "[00:00.00] Ingesting raw audio file stream..."]);

    if (isBackendConnected) {
      try {
        // Step 1: Transcribe audio using Whisper
        setLogs(prev => [...prev, "[00:00.12] Dispatching stream to Whisper-v3 LPU..."]);
        const formData = new FormData();
        formData.append("file", file);

        const transcribeRes = await fetch(`${API_BASE}/api/transcribe`, {
          method: 'POST',
          body: formData
        });
        if (!transcribeRes.ok) throw new Error("Whisper transcription failed.");
        const transcribeData = await transcribeRes.json();
        
        setTranscript(transcribeData.text);
        setLogs(prev => [...prev, `[00:00.65] Transcribed: "${transcribeData.text}"`]);

        // Step 2: Parse actions
        setLogs(prev => [...prev, "[00:00.80] Commencing multi-intent reasoning..."]);
        const parseRes = await fetch(`${API_BASE}/api/parse-actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcribeData.text })
        });
        if (!parseRes.ok) throw new Error("LLaMA parsing failed.");
        const parseData = await parseRes.json();

        // Telemetry Update
        const duration = Math.round(performance.now() - startTime);
        setLatency(duration);

        setLogs(prev => [
          ...prev,
          `[00:01.12] Parsing complete. Accuracy rating: ${(parseData.meta.confidence_score * 100).toFixed(1)}%`,
          `[00:01.15] Risk state: ${parseData.meta.risk_level} | Human confirmation: ${parseData.meta.requires_human_confirmation}`
        ]);

        setActions(parseData.actions);
        setMeta(parseData.meta);
        toast.success("Voice command translated successfully!");

      } catch (err) {
        console.error(err);
        setLogs(prev => [...prev, `[ERROR] Ingestion failed: ${err.message}`]);
        toast.error("Pipeline failure. Falling back to local demo processor.");
        runMockSimulation("Audio upload simulated transcription.");
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Offline fallback
      await writeSimulatedLogs([
        "[00:00.18] Running Groq Whisper-v3 LPU pipeline...",
        "[00:00.42] Live voice data extracted successfully.",
        '[00:00.65] Decoded transcript: "Schedule a sync for tomorrow and notify Trello board."'
      ], 600);
      setTranscript("Schedule a sync for tomorrow and notify Trello board.");
      runMockSimulation("Schedule a sync for tomorrow and notify Trello board.");
    }
  };

  // Mock simulation for offline or testing mode
  const runMockSimulation = async (sampleText) => {
    setIsProcessing(true);
    const textLower = sampleText.toLowerCase();
    let mockActions = [];
    let mockMeta = {
      confidence_score: 0.94,
      risk_level: 'LOW',
      requires_human_confirmation: false,
      estimated_execution_time_ms: 180,
      schedule_conflicts: []
    };

    if (textLower.includes('sync') || textLower.includes('morning')) {
      mockActions = [
        {
          type: 'calendar',
          title: 'Morning Executive Sync',
          start_time: new Date(Date.now() + 86400000).toISOString(), // tomorrow
          duration_minutes: 45
        },
        {
          type: 'task',
          board: 'Marketing',
          title: 'Draft Q3 Press Release',
          priority: 'Medium'
        },
        {
          type: 'communication',
          channel: 'email',
          recipient: 'julia@example.com',
          subject: 'Q3 Planning Outline',
          body: 'Hi Julia,\n\nHere is our initial planning outline and budget forecasts for Q3. Please let me know your thoughts.\n\nBest,\nExecutive Agent'
        }
      ];
    } else if (textLower.includes('urgent') || textLower.includes('emergency') || textLower.includes('hotfix')) {
      mockActions = [
        {
          type: 'task',
          board: 'DevOps',
          title: 'Patch SSR vulnerability immediately',
          priority: 'High'
        },
        {
          type: 'communication',
          channel: 'slack',
          recipient: '#engineering-ops',
          subject: 'Active Hotfix Deployment Alert',
          body: 'WARNING: Active patch deployment in progress for SSR vulnerability. Expect transient container restarts.'
        }
      ];
      mockMeta.risk_level = 'MEDIUM';
      mockMeta.requires_human_confirmation = true;
    } else {
      // Default / Pitch Scenario
      mockActions = [
        {
          type: 'calendar',
          title: 'Investor Pitch - Venture Partners',
          start_time: new Date(Date.now() + 86400000 * 3).toISOString(),
          duration_minutes: 60
        },
        {
          type: 'communication',
          channel: 'email',
          recipient: 'partners@venturepartners.com',
          subject: 'Investor Presentation Materials',
          body: 'Dear Partners,\n\nThank you for scheduling the pitch meeting. Attached is our presentation materials deck for review.\n\nSincerely,\nOperations Office'
        }
      ];
    }

    await writeSimulatedLogs([
      "[00:00.95] Injecting mock telemetry variables...",
      `[00:01.20] Resolved relative timestamps from dynamic local clock.`,
      `[00:01.35] Execution cards ready. Awaiting approval dispatch.`
    ], 300);

    setActions(mockActions);
    setMeta(mockMeta);
    setLatency(342);
    setIsProcessing(false);
    toast.success("Simulation cards created.");
  };

  // Dispatch handler to submit structural payload to webhook and logs DB
  const handleExecuteDispatch = async () => {
    if (actions.length === 0) return;

    setIsProcessing(true);
    setLogs(prev => [...prev, "[00:01.80] Launching execution router dispatch..."]);

    const payload = {
      summary: `Dispatched execution containing ${actions.length} operational steps.`,
      raw_transcript: transcript,
      actions: actions,
      meta: meta || {
        confidence_score: 1.0,
        risk_level: 'LOW',
        requires_human_confirmation: false,
        estimated_execution_time_ms: 200,
        schedule_conflicts: []
      }
    };

    if (isBackendConnected) {
      try {
        setLogs(prev => [...prev, "[00:01.95] Transferring secure JSON payload to execution endpoint..."]);
        
        // Call the FastAPI dispatch router
        const response = await fetch(`${API_BASE}/api/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Dispatch request rejected by server.");
        const result = await response.json();

        setLogs(prev => [
          ...prev,
          `[00:02.32] Make Webhook Dispatch: ${result.webhook_dispatched ? 'DELIVERED' : 'SKIPPED'}`,
          `[00:02.35] Supabase Audit Record: ${result.logged_to_db ? 'SAVED' : 'SKIPPED'}`,
          "[00:02.40] Pipeline processing completed successfully. Operational tasks in execution phase."
        ]);

        // Add to history list
        const newLog = {
          id: Date.now().toString(),
          summary: payload.summary,
          raw_transcript: payload.raw_transcript,
          actions_count: actions.length,
          payload: actions,
          status: result.status || 'dispatched',
          created_at: new Date().toISOString()
        };

        const updatedHistory = [newLog, ...historyLogs];
        setHistoryLogs(updatedHistory);
        localStorage.setItem('voiceforge_history', JSON.stringify(updatedHistory));

        toast.success(isDryRun ? "Dry-run simulation completed!" : "Live Webhook successfully executed!");

      } catch (err) {
        console.error(err);
        setLogs(prev => [...prev, `[ERROR] Dispatch failed: ${err.message}`]);
        toast.error("Failed to execute dispatch.");
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Offline fallback simulation
      await writeSimulatedLogs([
        "[00:01.95] Sending mock dispatch webhook (Make.com)...",
        "[00:02.20] Saving audit trail parameters to local cache storage...",
        "[00:02.42] Dispatch sequence successfully simulated."
      ], 550);

      const newLog = {
        id: Date.now().toString(),
        summary: payload.summary,
        raw_transcript: payload.raw_transcript,
        actions_count: actions.length,
        payload: actions,
        status: isDryRun ? 'dry_run' : 'dispatched',
        created_at: new Date().toISOString()
      };

      const updatedHistory = [newLog, ...historyLogs];
      setHistoryLogs(updatedHistory);
      localStorage.setItem('voiceforge_history', JSON.stringify(updatedHistory));

      setIsProcessing(false);
      toast.success(isDryRun ? "Simulation run complete!" : "Live execution simulated!");
    }
  };

  const handleClearHistory = () => {
    setHistoryLogs([]);
    localStorage.removeItem('voiceforge_history');
    toast.success("History audit logs cleared.");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Header telemetry system */}
      <Header 
        isDryRun={isDryRun} 
        setIsDryRun={setIsDryRun} 
        latency={latency} 
        onOpenHistory={() => setIsHistoryOpen(true)}
        isBackendConnected={isBackendConnected}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        
        {/* Connection status warning */}
        {!isBackendConnected && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 flex gap-3 items-center text-xs font-mono glow-amber">
            <HelpCircle className="w-5 h-5 animate-pulse text-amber-400 shrink-0" />
            <div className="flex-1">
              <span className="font-bold">FASTAPI SERVER OFFLINE</span>: The VoiceForge Ops backend server is currently unreachable. The application has automatically toggled on **Resilient Offline Mode** to mock Groq intelligence and Make Webhook dispatching natively.
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-[10px] hover:bg-amber-500/30 transition uppercase font-bold cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Section 1: Ingest Controls */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 font-mono">01 // AUDIO INGEST CONTROLS</span>
          </div>
          <AudioInput 
            onProcessText={handleProcessText}
            onProcessAudioFile={handleProcessAudioFile}
            isProcessing={isProcessing}
          />
        </section>

        {/* Section 2: Agent Reasoning Terminal */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 font-mono">02 // AUTONOMOUS REASONING LOGS</span>
          </div>
          <LiveTerminal 
            logs={logs}
            transcript={transcript}
            isProcessing={isProcessing}
          />
        </section>

        {/* Section 3: Action Execution Matrix */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 font-mono">03 // ACTION EXECUTION MATRIX</span>
          </div>
          <ActionCards 
            actions={actions}
            meta={meta}
            onDispatch={handleExecuteDispatch}
            isDryRun={isDryRun}
          />
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-[10px] text-zinc-600 font-mono">
        VOICEFORGE OPS // HACKATHON VERSION 1.0.0 // POWERED BY GROQ & FASTAPI
      </footer>

      {/* Slide-over Audit Drawer */}
      <HistoryDrawer 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyLogs={historyLogs}
        onClearHistory={handleClearHistory}
      />

      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}
