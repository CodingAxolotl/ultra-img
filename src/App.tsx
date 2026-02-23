import { useState, useEffect, useRef, useCallback } from 'react';
import { Client } from '@gradio/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Bell,
  FolderOpen,
  Sparkles,
  Zap,
  Clock,
  Download,
  Keyboard,
  ChevronDown,
} from 'lucide-react';
import { CreeperFace, CreeperFaceMini } from './components/CreeperFace';
import { ParticleBackground } from './components/ParticleBackground';
import { ConfettiCanvas } from './components/ConfettiCanvas';
import { Modal } from './components/Modal';
import { PromptTags } from './components/PromptTags';

// ─── TYPES ───
interface HistoryItem {
  image: string;
  model: string;
  date: number;
}

// ─── WATERMARK SYSTEM ───
async function addWatermark(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Image;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const fontSize = Math.max(12, img.width / 40);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const lines = ['ultra-img', '.vercel.app'];
      const lineHeight = fontSize * 1.2;
      const x = canvas.width - 15;
      let y = canvas.height - 15 - lineHeight * (lines.length - 1);
      lines.forEach((line, i) => {
        ctx.fillText(line, x, y + i * lineHeight);
      });
      resolve(canvas.toDataURL('image/png'));
    };
  });
}

async function fetchImageAsBlob(imageRef: unknown): Promise<Blob> {
  let url = '';
  if (typeof imageRef === 'string') url = imageRef;
  else if (imageRef && typeof imageRef === 'object') {
    const obj = imageRef as Record<string, string>;
    if (obj.url) url = obj.url;
    else if (obj.path) url = obj.path;
  }
  const response = await fetch(url);
  return await response.blob();
}

function downloadBase64(base64: string, filename: string) {
  const a = document.createElement('a');
  a.href = base64;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── CREDIT CALCULATIONS ───
function calculateMaxCredits(): number {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  let max = 100;
  if (day === 5) max = 110;
  if (day === 6) max = 120;
  if (day === 0) max = 130;
  if (day === 0 && hour >= 17 && hour < 19) max = 150;
  return max;
}

function isHappyHour(): boolean {
  const now = new Date();
  return now.getDay() === 0 && now.getHours() >= 17 && now.getHours() < 19;
}

function getCostForSpeed(speed: string): number {
  if (speed === 'default') return 10;
  if (speed === 'slower') return 5;
  return 2;
}

function getWaitForSpeed(speed: string): number {
  if (speed === 'slower') return 100;
  if (speed === 'slowest') return 300;
  return 0;
}

// ─── MAIN APP ───
export function App() {
  // State
  const [credits, setCredits] = useState(() => {
    const saved = localStorage.getItem('creeper_credits');
    return saved !== null ? parseInt(saved) : calculateMaxCredits();
  });
  const [maxCredits, setMaxCredits] = useState(calculateMaxCredits);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('creeper_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [model, setModel] = useState('default');
  const [speed, setSpeed] = useState('default');
  const [prompt, setPrompt] = useState('');
  const [width, setWidth] = useState('512');
  const [height, setHeight] = useState('512');
  const [steps, setSteps] = useState(5);

  const [generating, setGenerating] = useState(false);
  const [statusText, setStatusText] = useState('Generating...');
  const [waitTime, setWaitTime] = useState(0);
  const [showWaitTimer, setShowWaitTimer] = useState(false);
  const [hideBlobDuringWait, setHideBlobDuringWait] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [burstMode, setBurstMode] = useState(false);

  const [happyHour, setHappyHour] = useState(isHappyHour);
  const [confettiActive, setConfettiActive] = useState(isHappyHour);

  const [tipsOpen, setTipsOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [showShortcutHint, setShowShortcutHint] = useState(false);

  const currentCleanBase64Ref = useRef<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem('creeper_credits', String(credits));
  }, [credits]);

  useEffect(() => {
    localStorage.setItem('creeper_history', JSON.stringify(history));
  }, [history]);

  // Credit reset check
  const checkCreditReset = useCallback(() => {
    const newMax = calculateMaxCredits();
    setMaxCredits(newMax);

    const now = new Date();
    const currentHourToken = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
    const lastRefillToken = localStorage.getItem('creeper_last_refill');

    if (lastRefillToken !== currentHourToken) {
      setCredits(newMax);
      localStorage.setItem('creeper_last_refill', currentHourToken);
    }
  }, []);

  useEffect(() => {
    checkCreditReset();
    const interval = setInterval(checkCreditReset, 5000);
    return () => clearInterval(interval);
  }, [checkCreditReset]);

  // Happy hour check
  useEffect(() => {
    const check = () => {
      const hh = isHappyHour();
      setHappyHour(hh);
      setConfettiActive(hh);
      setMaxCredits(calculateMaxCredits());
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Show keyboard hint once on focus
  useEffect(() => {
    const ta = promptRef.current;
    if (!ta) return;
    const handler = () => {
      setShowShortcutHint(true);
      setTimeout(() => setShowShortcutHint(false), 3000);
    };
    ta.addEventListener('focus', handler, { once: true });
    return () => ta.removeEventListener('focus', handler);
  }, []);

  // ─── DOWNLOAD LOGIC ───
  const handleDownloadLogic = useCallback(
    async (cleanBase64: string, itemModel: string) => {
      if (itemModel === 'pro') {
        downloadBase64(cleanBase64, `creeper-pro-${Date.now()}.png`);
      } else {
        const confirmMsg =
          'Do you want to download with watermark?\n\n[OK] Yes (Free)\n[Cancel] No, remove watermark (10 Credits)';
        if (confirm(confirmMsg)) {
          const wmBase64 = await addWatermark(cleanBase64);
          downloadBase64(wmBase64, `creeper-wm-${Date.now()}.png`);
        } else {
          if (credits >= 10) {
            setCredits((c) => c - 10);
            downloadBase64(cleanBase64, `creeper-clean-${Date.now()}.png`);
          } else {
            alert('❌ Not enough credits (10 required) to remove watermark.');
          }
        }
      }
    },
    [credits]
  );

  // ─── GENERATE ───
  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      alert('⚠️ Please enter a prompt.');
      return;
    }

    let cost = 0;
    if (model === 'default') {
      cost = getCostForSpeed(speed);
      checkCreditReset();
      if (credits < cost) {
        alert(`❌ Not enough credits! You need ${cost}.`);
        return;
      }
    }

    // UI animation
    setBurstMode(true);
    setTimeout(() => setBurstMode(false), 3000);

    setGenerating(true);
    setResultImage(null);
    setErrorText(null);
    setShowWaitTimer(false);
    setHideBlobDuringWait(false);

    setStatusText(
      model === 'default'
        ? `Generating (Cost: ${cost})...`
        : 'Generating PRO (Free)...'
    );

    try {
      if (model === 'default') {
        setCredits((c) => c - cost);
      }

      let imgData: unknown = null;

      if (model === 'default') {
        const client = await Client.connect('CryptoCreeper/image-pro');
        const result = await client.predict('/generate_workflow', {
          prompt: trimmedPrompt,
          width: parseInt(width),
          height: parseInt(height),
          steps: steps,
        });
        imgData = (result.data as unknown[])[1];
      } else {
        const client = await Client.connect('mrfakename/Z-Image-Turbo');
        const result = await client.predict('/generate_image', {
          prompt: trimmedPrompt,
          width: parseInt(width),
          height: parseInt(height),
          num_inference_steps: steps,
          seed: Math.floor(Math.random() * 100000),
          randomize_seed: true,
        });
        imgData = (result.data as unknown[])[0];
      }

      const resultBlob = await fetchImageAsBlob(imgData);
      const reader = new FileReader();
      const cleanBase64: string = await new Promise((r) => {
        reader.readAsDataURL(resultBlob);
        reader.onloadend = () => r(reader.result as string);
      });
      currentCleanBase64Ref.current = cleanBase64;

      // Delay logic
      if (model === 'default' && speed !== 'default') {
        setStatusText('Receiving...');
        setShowWaitTimer(true);
        setHideBlobDuringWait(true);

        const totalWait = getWaitForSpeed(speed);
        let counter = totalWait;
        setWaitTime(counter);

        await new Promise<void>((resolve) => {
          const timer = setInterval(() => {
            counter--;
            setWaitTime(counter);
            if (counter <= 0) {
              clearInterval(timer);
              resolve();
            }
          }, 1000);
        });
        setHideBlobDuringWait(false);
      }

      let displayUrl: string;
      if (model === 'default') {
        displayUrl = await addWatermark(cleanBase64);
      } else {
        displayUrl = cleanBase64;
      }

      setResultImage(displayUrl);
      setGenerating(false);
      setStatusText('Done!');

      // Save to history
      setHistory((prev) => {
        const newHist = [{ image: cleanBase64, model, date: Date.now() }, ...prev];
        return newHist.slice(0, 3);
      });
    } catch (error: unknown) {
      console.error(error);
      setGenerating(false);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setErrorText(msg);
      if (model === 'pro') alert('PRO Limit Reached or Error.');
    }
  };

  // ─── CREDIT BAR ───
  const creditPercentage = Math.min((credits / maxCredits) * 100, 100);
  const barColor =
    credits > maxCredits * 0.6
      ? '#22c55e'
      : credits > maxCredits * 0.3
        ? '#fbbf24'
        : '#ef4444';

  const cost = model === 'default' ? getCostForSpeed(speed) : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden relative">
      {/* Background Effects */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 0% 0%, rgba(34,197,94,0.08) 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(34,197,94,0.05) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(34,197,94,0.03) 0%, transparent 70%)',
        }}
      />
      <ParticleBackground />
      <ConfettiCanvas active={confettiActive} />

      {/* Scanline overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.015]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center px-4 py-6 md:px-6 md:py-8 max-w-[860px] mx-auto">
        {/* ─── HEADER ─── */}
        <header className="w-full flex flex-col items-center mb-6">
          <div className="flex items-center gap-4 mb-4">
            <CreeperFace size={56} />
            <h1
              className={`text-xl md:text-3xl font-bold tracking-tight ${happyHour ? '' : ''}`}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                ...(happyHour
                  ? {
                      background:
                        'linear-gradient(90deg, #ff0000, #ffa500, #ffff00, #008000, #0000ff, #4b0082, #ee82ee)',
                      backgroundSize: '300% 300%',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      animation: 'rainbowMove 2s linear infinite, wiggle 1s ease-in-out infinite',
                    }
                  : {
                      background: 'linear-gradient(90deg, #fff, #22c55e, #fff)',
                      backgroundSize: '200% auto',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      animation: 'shine 5s linear infinite',
                    }),
              }}
            >
              Creeper Image Gen
            </h1>
          </div>

          {happyHour && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-[0.6rem] font-bold uppercase tracking-widest mb-3"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.5rem' }}
            >
              🎉 HAPPY HOUR ACTIVE 🎉
            </motion.div>
          )}

          <nav className="w-full flex justify-end gap-2 flex-wrap">
            {[
              { label: 'Tips', icon: <Lightbulb size={14} />, emoji: '💡', action: () => setTipsOpen(true) },
              { label: 'Updates', icon: <Bell size={14} />, emoji: '🆕', action: () => setUpdatesOpen(true) },
              { label: 'History', icon: <FolderOpen size={14} />, emoji: '📂', action: () => setHistoryOpen(true) },
            ].map((btn) => (
              <motion.button
                key={btn.label}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={btn.action}
                className="mc-btn bg-[#1a1a1a] border-[#444] text-[#ccc] hover:text-white hover:border-[#22c55e] hover:bg-[#22c55e15] px-3 py-2 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {btn.icon}
                {btn.label} {btn.emoji}
              </motion.button>
            ))}
          </nav>
        </header>

        {/* ─── CREDIT SYSTEM ─── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mb-6 p-4 bg-[#111] border-2 border-[#222] relative overflow-hidden"
          style={{
            boxShadow:
              'inset -2px -2px 0px 0px rgba(0,0,0,0.4), inset 2px 2px 0px 0px rgba(255,255,255,0.03), 0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          {/* Ore accent glow */}
          <div
            className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${barColor}22 0%, transparent 70%)`,
              animation: 'oreGlow 3s ease-in-out infinite',
            }}
          />

          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-[#22c55e]" />
              <span
                className="text-[0.6rem] uppercase tracking-widest text-[#888]"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.5rem' }}
              >
                Credits
              </span>
            </div>
            <span
              className="text-sm font-bold"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '0.65rem',
                color: barColor,
              }}
            >
              {credits} / {maxCredits}
            </span>
          </div>

          <div className="w-full h-3 bg-[#222] border border-[#333] overflow-hidden">
            <motion.div
              className="h-full"
              initial={false}
              animate={{ width: `${creditPercentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                background: barColor,
                boxShadow: `0 0 10px ${barColor}, inset 0 1px 0 rgba(255,255,255,0.3)`,
              }}
            />
          </div>

          <div className="flex justify-between mt-2">
            <span className="text-[0.6rem] text-[#555]">
              Max Capacity: {maxCredits}
            </span>
            <span className="text-[0.6rem] text-[#555]">
              Refills at XX:00
            </span>
          </div>
        </motion.div>

        {/* ─── MAIN CONTAINER ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full bg-[#111] border-2 border-[#222] p-5 md:p-7 relative"
          style={{
            boxShadow:
              'inset -3px -3px 0px 0px rgba(0,0,0,0.3), inset 3px 3px 0px 0px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#22c55e] opacity-40" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#22c55e] opacity-40" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#22c55e] opacity-40" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#22c55e] opacity-40" />

          {/* Model Selector */}
          <div className="space-y-4 mb-5">
            <div>
              <label
                className="text-[0.55rem] uppercase tracking-widest text-[#666] mb-2 block"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                Select Model
              </label>
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-[#1a1a1a] border-2 border-[#333] text-white p-3 text-sm outline-none transition-all focus:border-[#22c55e] focus:shadow-[0_0_0_2px_rgba(34,197,94,0.15)] appearance-none cursor-pointer pr-10"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  <option value="default">Default (Costs Credits) - CryptoCreeper/image-pro</option>
                  <option value="pro">PRO (Free / No Watermark) - Z-Image-Turbo</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
            </div>

            {/* Speed Control - only for Default */}
            <AnimatePresence>
              {model === 'default' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#22c55e08] border border-[#22c55e33] p-3">
                    <label
                      className="text-[0.55rem] uppercase tracking-widest text-[#22c55e99] mb-2 block"
                      style={{ fontFamily: "'Press Start 2P', monospace" }}
                    >
                      Speed & Cost
                    </label>
                    <div className="relative">
                      <select
                        value={speed}
                        onChange={(e) => setSpeed(e.target.value)}
                        className="w-full bg-[#111] border-2 border-[#22c55e44] text-white p-3 text-sm outline-none transition-all focus:border-[#22c55e] appearance-none cursor-pointer pr-10"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        <option value="default">Standard Speed (10 Credits) - Instant View</option>
                        <option value="slower">Slower (5 Credits) - 100s Wait</option>
                        <option value="slowest">Slowest (2 Credits) - 300s Wait</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#22c55e66] pointer-events-none" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Prompt */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label
                className="text-[0.55rem] uppercase tracking-widest text-[#666]"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                Prompt
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[0.65rem] text-[#444]">
                  {prompt.length} chars
                </span>
                <AnimatePresence>
                  {showShortcutHint && (
                    <motion.span
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[0.6rem] text-[#22c55e88] flex items-center gap-1"
                    >
                      <Keyboard size={10} />
                      Ctrl+Enter
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <PromptTags
              onTagClick={(text) => {
                setPrompt((prev) => (prev ? prev + ', ' + text : text));
                promptRef.current?.focus();
              }}
            />

            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your image... a creeper in a dark cave, glowing emeralds..."
              className="w-full bg-[#1a1a1a] border-2 border-[#333] text-white p-3 text-sm outline-none transition-all focus:border-[#22c55e] focus:shadow-[0_0_0_2px_rgba(34,197,94,0.15)] resize-vertical min-h-[100px]"
              style={{ fontFamily: "'Inter', sans-serif" }}
            />
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            <div className="tooltip-wrapper">
              <label
                className="text-[0.5rem] uppercase tracking-widest text-[#666] mb-1.5 block"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                Width
              </label>
              <div className="relative">
                <select
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  className="w-full bg-[#1a1a1a] border-2 border-[#333] text-white p-2.5 text-sm outline-none focus:border-[#22c55e] appearance-none cursor-pointer pr-8"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  <option value="512">512px</option>
                  <option value="640">640px</option>
                  <option value="768">768px</option>
                  <option value="1024">1024px</option>
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
              <span className="tooltip-text">Image width in pixels</span>
            </div>

            <div className="tooltip-wrapper">
              <label
                className="text-[0.5rem] uppercase tracking-widest text-[#666] mb-1.5 block"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                Height
              </label>
              <div className="relative">
                <select
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full bg-[#1a1a1a] border-2 border-[#333] text-white p-2.5 text-sm outline-none focus:border-[#22c55e] appearance-none cursor-pointer pr-8"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  <option value="512">512px</option>
                  <option value="640">640px</option>
                  <option value="768">768px</option>
                  <option value="1024">1024px</option>
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none" />
              </div>
              <span className="tooltip-text">Image height in pixels</span>
            </div>

            <div className="tooltip-wrapper col-span-2 md:col-span-1">
              <label
                className="text-[0.5rem] uppercase tracking-widest text-[#666] mb-1.5 block"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                Steps (4-12)
              </label>
              <div className="flex items-center gap-3 bg-[#1a1a1a] border-2 border-[#333] p-2.5">
                <input
                  type="range"
                  value={steps}
                  onChange={(e) => setSteps(parseInt(e.target.value))}
                  min={4}
                  max={12}
                  step={1}
                  className="flex-1"
                />
                <span
                  className="font-bold text-[#22c55e] min-w-[24px] text-center text-sm"
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '0.7rem' }}
                >
                  {steps}
                </span>
              </div>
              <span className="tooltip-text">More steps = better quality, slower</span>
            </div>
          </div>

          {/* Cost Indicator */}
          {model === 'default' && (
            <motion.div
              layout
              className="flex items-center justify-between mb-4 px-3 py-2 bg-[#22c55e08] border border-[#22c55e22]"
            >
              <div className="flex items-center gap-2 text-[0.7rem] text-[#22c55e99]">
                <Zap size={12} />
                <span>This generation will cost <strong className="text-[#22c55e]">{cost} credits</strong></span>
              </div>
              <div className="text-[0.65rem] text-[#555]">
                {credits >= cost ? `${credits - cost} remaining after` : '⚠️ Not enough'}
              </div>
            </motion.div>
          )}

          {/* Generate Button */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={generating}
            onClick={handleGenerate}
            className={`w-full py-4 font-bold text-sm uppercase tracking-widest border-2 border-black cursor-pointer transition-all relative overflow-hidden ${
              generating ? 'opacity-50 cursor-not-allowed grayscale' : ''
            }`}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '0.7rem',
              background: burstMode
                ? 'linear-gradient(135deg, #9333ea, #7e22ce)'
                : 'linear-gradient(135deg, #22c55e, #15803d)',
              color: burstMode ? 'white' : 'black',
              boxShadow: burstMode
                ? '0 0 25px rgba(147,51,234,0.6), inset -3px -3px 0 rgba(0,0,0,0.3), inset 3px 3px 0 rgba(255,255,255,0.15)'
                : 'inset -3px -3px 0 rgba(0,0,0,0.3), inset 3px 3px 0 rgba(255,255,255,0.15), 0 0 20px rgba(34,197,94,0.2)',
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Sparkles size={16} />
              {generating ? 'Generating...' : 'Generate Image'}
            </span>
            {/* Shimmer effect */}
            {!generating && (
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shine 3s linear infinite',
                }}
              />
            )}
          </motion.button>

          {/* ─── RESULT CONTAINER ─── */}
          <div className="mt-6 flex flex-col items-center justify-center min-h-[350px] bg-[#0a0a0a] border-2 border-[#1a1a1a] relative overflow-hidden p-5">
            {/* Grid pattern background */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />

            {/* Loader */}
            <AnimatePresence>
              {generating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-6 z-10"
                >
                  {!hideBlobDuringWait && (
                    <div
                      className="w-[160px] h-[160px] md:w-[180px] md:h-[180px]"
                      style={{
                        borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
                        backgroundImage:
                          'repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(255,255,255,0.3) 15px, rgba(255,255,255,0.3) 30px)',
                        backgroundSize: '200% 200%',
                        backgroundColor: '#9333ea',
                        animation:
                          'morph 8s ease-in-out infinite, colorCycle 40s linear infinite, stripMove 2s linear infinite',
                        boxShadow:
                          'inset 0 0 20px rgba(255,255,255,0.3), 0 0 30px rgba(0,0,0,0.5)',
                      }}
                    />
                  )}

                  <div
                    className="text-sm text-[#ddd] font-medium tracking-wide text-center"
                    style={{ animation: 'pulse 1.5s infinite' }}
                  >
                    {statusText}
                  </div>

                  {showWaitTimer && (
                    <div className="text-xs text-[#666] flex items-center gap-1.5">
                      <Clock size={12} />
                      {waitTime}s remaining...
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Placeholder */}
            {!generating && !resultImage && !errorText && (
              <div className="flex flex-col items-center gap-3 text-[#333]">
                <CreeperFaceMini size={40} />
                <span className="text-sm italic">Image will appear here</span>
              </div>
            )}

            {/* Error */}
            {errorText && !generating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[#ef4444] text-sm text-center"
              >
                ❌ Error: {errorText}
              </motion.div>
            )}

            {/* Result Image */}
            <AnimatePresence>
              {resultImage && !generating && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 20 }}
                  className="relative group"
                >
                  <img
                    src={resultImage}
                    alt="Generated Result"
                    className="max-w-full rounded-sm cursor-pointer transition-transform hover:scale-[1.01]"
                    style={{ boxShadow: '0 5px 30px rgba(0,0,0,0.6)' }}
                    onClick={() => {
                      if (currentCleanBase64Ref.current) {
                        handleDownloadLogic(currentCleanBase64Ref.current, model);
                      }
                    }}
                  />
                  {/* Download overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                    <div className="bg-black/80 px-4 py-2 flex items-center gap-2 text-sm text-white border border-[#333]">
                      <Download size={14} />
                      Click to Download
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ─── FOOTER ─── */}
        <footer className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-[#333] text-[0.5rem]" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            <CreeperFaceMini size={12} />
            <span>Creeper Image Gen</span>
            <CreeperFaceMini size={12} />
          </div>
        </footer>
      </div>

      {/* ─── MODALS ─── */}

      {/* Tips Modal */}
      <Modal isOpen={tipsOpen} onClose={() => setTipsOpen(false)} title="Generation Tips 💡">
        <ul className="space-y-3">
          {[
            {
              title: 'Speed Optimization',
              desc: 'The lower the resolution and steps, the faster the image will be generated.',
              icon: '⚡',
            },
            {
              title: 'Model Choice',
              desc: 'PRO is free and fast but rate-limited. Default has high quality but costs credits.',
              icon: '🎯',
            },
            {
              title: 'Prompt Tips',
              desc: 'Be descriptive! Include style, lighting, and mood keywords for better results.',
              icon: '✍️',
            },
            {
              title: 'Quick Tags',
              desc: 'Use the quick tags above the prompt to quickly add style keywords.',
              icon: '🏷️',
            },
            {
              title: 'Keyboard Shortcut',
              desc: 'Press Ctrl+Enter (or Cmd+Enter on Mac) to generate instantly.',
              icon: '⌨️',
            },
          ].map((tip, i) => (
            <li
              key={i}
              className="bg-[#ffffff08] p-3 border-l-3 border-[#22c55e]"
              style={{ borderLeftWidth: 3 }}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{tip.icon}</span>
                <div>
                  <strong className="text-[#22c55e] text-sm">{tip.title}</strong>
                  <p className="text-[#aaa] text-xs mt-1">{tip.desc}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Modal>

      {/* Updates Modal */}
      <Modal isOpen={updatesOpen} onClose={() => setUpdatesOpen(false)} title="Latest Updates 🆕">
        <ul className="space-y-3">
          {[
            {
              title: 'Dynamic Credit Calendar',
              desc: 'Max credits change daily (Fri: 110, Sat: 120, Sun: 130). Happy Hour is Sunday 17:00-19:00 (Max 150 + FX)!',
            },
            {
              title: 'Speed Tiers (Save Credits)',
              desc: "Choose 'Slower' (5 credits) or 'Slowest' (2 credits) to save money on the Default model.",
            },
            {
              title: 'Watermark Control',
              desc: 'Download with Watermark for free, or use 10 credits to remove it. (Now with smaller watermark size!).',
            },
          ].map((update, i) => (
            <li
              key={i}
              className="bg-[#ffffff08] p-3"
              style={{ borderLeftWidth: 3, borderLeftColor: '#22c55e', borderLeftStyle: 'solid' }}
            >
              <strong className="text-[#22c55e] text-sm">{update.title}</strong>
              <p className="text-[#aaa] text-xs mt-1">{update.desc}</p>
            </li>
          ))}
        </ul>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Recent History 📂">
        {history.length === 0 ? (
          <p className="text-[#666] text-center text-sm py-8">No history yet. Generate your first image!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {history.map((item, i) => (
              <HistoryThumbnail
                key={i}
                item={item}
                onClick={() => handleDownloadLogic(item.image, item.model)}
              />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── HISTORY THUMBNAIL ───
function HistoryThumbnail({ item, onClick }: { item: HistoryItem; onClick: () => void }) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);

  useEffect(() => {
    if (item.model === 'default') {
      addWatermark(item.image).then(setDisplaySrc);
    } else {
      setDisplaySrc(item.image);
    }
  }, [item]);

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      onClick={onClick}
      className="relative cursor-pointer overflow-hidden aspect-square bg-black border-2 border-transparent hover:border-[#22c55e] transition-colors"
    >
      {displaySrc && (
        <img src={displaySrc} alt="History" className="w-full h-full object-cover" />
      )}
      <div
        className="absolute bottom-1.5 right-1.5 text-[0.55rem] px-1.5 py-0.5 font-bold uppercase"
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '0.4rem',
          background: item.model === 'default' ? '#22c55e' : '#3b82f6',
          color: item.model === 'default' ? '#000' : '#fff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        {item.model === 'default' ? 'DEF' : 'PRO'}
      </div>
    </motion.div>
  );
}
