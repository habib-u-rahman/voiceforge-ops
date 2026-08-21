import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, Play, FileAudio } from 'lucide-react';

export default function AudioInput({ onProcessText, onProcessAudioFile, isProcessing }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      setSelectedFile(null);

      // Audio Context & Analyser
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      sourceRef.current = source;

      // Media Recorder — pick a MIME type the browser actually supports,
      // and derive the file extension from it (recorded audio is NOT real WAV
      // data, so mislabeling it as .wav breaks Whisper decoding server-side).
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4'
      ];
      const supportedType = preferredTypes.find(t => MediaRecorder.isTypeSupported?.(t)) || '';
      const mediaRecorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);
      const extensionMap = {
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a'
      };
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const actualType = mediaRecorder.mimeType || 'audio/webm';
        const baseType = actualType.split(';')[0];
        const ext = extensionMap[baseType] || 'webm';
        const blob = new Blob(chunks, { type: actualType });
        const file = new File([blob], `recording.${ext}`, { type: actualType });
        setSelectedFile(file);
        onProcessAudioFile(file);
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      // Draw canvas visualization
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const draw = () => {
          if (!canvasRef.current) return;
          animationRef.current = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);

          ctx.fillStyle = '#09090b'; // zinc 950
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const barWidth = (canvas.width / bufferLength) * 1.5;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
            
            // Draw dual symmetry visualizer
            const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, '#6366f1'); // Indigo 500
            gradient.addColorStop(1, '#06b6d4'); // Cyan 500

            ctx.fillStyle = gradient;
            ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth - 1, barHeight);
            x += barWidth;
          }
        };
        draw();
      }
    } catch (err) {
      console.error('Microphone access denied or error starting recorder:', err);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Stop all tracks in stream
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      onProcessAudioFile(file);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      onProcessAudioFile(file);
    }
  };

  // Preset scenarios definitions
  const presets = [
    {
      id: 'preset1',
      title: 'Morning Executive Sync',
      desc: 'Calendar sync + Trello card + Gmail draft',
      text: "Hey, please schedule a team sync tomorrow morning at 9 AM for 45 minutes to review project goals. Also, create a medium-priority task on Trello under the Marketing board titled 'Draft Q3 Press Release'. Finally, draft an email to julia@example.com with the subject 'Q3 Planning Outline' outlining our initial thoughts on the budget."
    },
    {
      id: 'preset2',
      title: 'Emergency Hotfix Alert',
      desc: 'High-priority task + Slack notification',
      text: "Urgent! We need to create a high-priority task on the DevOps Trello board titled 'Patch SSR vulnerability immediately'. Also, send an emergency Slack message to #engineering-ops alert channel warning them about the active hotfix deployment."
    },
    {
      id: 'preset3',
      title: 'Investor Pitch Setup',
      desc: 'Meeting schedule + follow-up email draft',
      text: "Schedule an investor pitch meeting with Venture Partners next Monday, August 24th at 2 PM for 60 minutes. After that, draft a follow-up email to partners@venturepartners.com with the subject 'Investor Presentation Materials' thanking them for their time and attaching our pitch deck."
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Voice Recorder & Drop Zone */}
      <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 backdrop-blur-md flex flex-col justify-between min-h-[260px] glow-indigo">
        
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold tracking-wider text-zinc-300 font-mono">
            // VOICE INPUT & AUDIO STREAM
          </h2>
          {isRecording && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 font-mono animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              RECORDING LIVE
            </span>
          )}
        </div>

        {/* Action Controls & Canvas Area */}
        <div className="flex-1 flex flex-col md:flex-row gap-6 items-center justify-center">
          
          {/* Recorder Button */}
          <div className="flex flex-col items-center justify-center gap-3">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition border-4 cursor-pointer focus:outline-none ${
                isRecording
                  ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30'
                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500'
              }`}
            >
              {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
            </button>
            <span className="text-xs text-zinc-400 font-mono">
              {isRecording ? 'Click to Stop & Parse' : 'Click to Speak'}
            </span>
          </div>

          {/* Visualizer Canvas OR File Dropzone */}
          <div className="flex-1 w-full h-32 rounded-lg overflow-hidden border border-zinc-800/80 bg-zinc-950 flex items-center justify-center relative">
            {isRecording ? (
              <canvas ref={canvasRef} className="w-full h-full" width={400} height={128} />
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full h-full flex flex-col items-center justify-center p-4 transition border-2 border-dashed ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-500/5'
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/80'
                }`}
              >
                <input
                  type="file"
                  id="audio-upload"
                  className="hidden"
                  accept=".mp3,.wav,.m4a,.webm,.ogg"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />
                
                <label htmlFor="audio-upload" className="flex flex-col items-center justify-center cursor-pointer text-zinc-400 hover:text-zinc-300">
                  <Upload className="w-7 h-7 mb-2 text-zinc-500" />
                  {selectedFile ? (
                    <div className="flex items-center gap-2 text-xs text-indigo-400">
                      <FileAudio className="w-4 h-4" />
                      <span className="font-mono truncate max-w-[200px]">{selectedFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-mono text-center">Drag & drop audio or click to upload</span>
                      <span className="text-[10px] text-zinc-600 mt-1">Supports: WAV, MP3, M4A, WEBM, OGG</span>
                    </>
                  )}
                </label>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Preset Test Scenarios */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 backdrop-blur-md flex flex-col justify-between glow-indigo">
        <div>
          <h2 className="text-sm font-semibold tracking-wider text-zinc-300 font-mono mb-3">
            // JUDGE DEMO PRESETS
          </h2>
          <p className="text-xs text-zinc-500 mb-4">
            Simulate fully-configured multi-intent operational inputs with 1-click test scenarios.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => !isProcessing && onProcessText(preset.text)}
              disabled={isProcessing}
              className="flex items-start gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900/60 hover:border-zinc-700 transition text-left cursor-pointer group disabled:opacity-50"
            >
              <div className="w-7 h-7 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5 group-hover:bg-indigo-500/20">
                <Play className="w-3.5 h-3.5 fill-current" />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-zinc-200 font-mono">{preset.title}</div>
                <div className="text-[10px] text-zinc-400 truncate mt-0.5">{preset.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
