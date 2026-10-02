import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, Flashlight, RefreshCw, Barcode, CheckCircle, Keyboard } from 'lucide-react';
import { playBeep } from '../services/sound';

interface BarcodeCameraScannerProps {
  title: string;
  subtitle?: string;
  mode?: 'barcode' | 'qrcode' | 'both';
  onScan: (decodedText: string) => void;
  onClose: () => void;
  quickSamples?: { label: string; value: string }[];
  beepEnabled?: boolean;
}

export const BarcodeCameraScanner: React.FC<BarcodeCameraScannerProps> = ({
  title,
  subtitle,
  mode = 'both',
  onScan,
  onClose,
  quickSamples,
  beepEnabled = true,
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const scannerRef = useRef<Html5Qrcode | null>(null);

  // html5-qrcode lança erro síncrono ao parar um scanner que não está rodando
  // (ex.: câmera negada) — isso derrubava o app inteiro.
  const safeStop = async () => {
    try {
      await scannerRef.current?.stop();
    } catch {}
  };
  const elementId = useRef(`barcode-scanner-${Math.random().toString(36).substring(2, 9)}`).current;

  useEffect(() => {
    let isMounted = true;

    async function startScanner() {
      try {
        setCameraError(null);
        // Wait for DOM element
        await new Promise((r) => setTimeout(r, 150));
        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode(elementId);
        scannerRef.current = html5QrCode;

        const qrbox = (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          if (mode === 'qrcode') {
            return {
              width: Math.floor(minEdge * 0.72),
              height: Math.floor(minEdge * 0.72),
            };
          }
          // Wide box for 1D Barcodes (EAN-13 / Code128)
          return {
            width: Math.floor(viewfinderWidth * 0.85),
            height: Math.floor(viewfinderHeight * 0.42),
          };
        };

        await html5QrCode.start(
          { facingMode },
          {
            fps: 15,
            qrbox,
            aspectRatio: 1.333333,
          },
          (decodedText) => {
            if (isMounted) {
              playBeep('scan', beepEnabled);
              handleScannedResult(decodedText);
            }
          },
          () => {
            // Frame scan callback (silent ignore frame misses)
          }
        );

        if (isMounted) {
          setIsScanning(true);
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.warn('Camera start issue:', err);
          const errorMsg = err instanceof Error ? err.message : String(err);
          setCameraError(
            errorMsg.includes('Permission')
              ? 'Permissão de câmera não concedida. Você pode digitar ou selecionar um código abaixo.'
              : 'Não foi possível acessar a câmera do dispositivo neste ambiente. Utilize a digitação ou simulação rápida.'
          );
          setShowManualInput(true);
        }
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        safeStop().finally(() => {
          try {
            scannerRef.current?.clear();
          } catch {}
        });
      }
    };
  }, [facingMode]);

  const handleScannedResult = (val: string) => {
    const clean = val.trim();
    if (!clean) return;
    // Stop scanner
    if (isScanning) {
      safeStop();
    }
    onScan(clean);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playBeep('scan', beepEnabled);
    handleScannedResult(manualCode);
  };

  const toggleCameraFacing = async () => {
    await safeStop();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const toggleTorch = async () => {
    try {
      if (scannerRef.current && isScanning) {
        // html5-qrcode torch support check
        // @ts-expect-error Torch capability access
        const track = scannerRef.current.stream?.getVideoTracks()[0];
        if (track && track.getCapabilities()?.torch) {
          await track.applyConstraints({
            advanced: [{ torch: !torchOn }],
          });
          setTorchOn(!torchOn);
        }
      }
    } catch {
      // Ignore unsupported torch
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md text-white animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Barcode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={toggleCameraFacing}
            title="Alternar Câmera"
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleTorch}
            title="Lanterna"
            className={`p-2 rounded-full transition-colors ${
              torchOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Flashlight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Fechar Leitor"
            className="h-11 pl-3 pr-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-sm flex items-center gap-1.5 shadow-md shadow-rose-900/40 transition-colors"
          >
            <X className="w-6 h-6" />
            <span>Fechar</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-3 overflow-hidden">
        {/* HTML5 QR Container */}
        <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden bg-black border-2 border-slate-700 shadow-2xl flex items-center justify-center">
          <div id={elementId} className="w-full h-full object-cover" />

          {/* Scanner Viewfinder Overlay */}
          {!cameraError && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Corner Targets */}
              <div
                className={`relative border-2 border-amber-400/80 rounded-lg shadow-inner ${
                  mode === 'qrcode' ? 'w-48 h-48' : 'w-64 sm:w-72 h-32'
                }`}
              >
                {/* Red animated laser line */}
                <div className="absolute left-1 right-1 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-bounce" />

                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-amber-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-amber-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-amber-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-amber-400" />
              </div>

              <div className="mt-4 bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-amber-300 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Posicione o código no centro</span>
              </div>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-900 p-5 flex flex-col items-center justify-center text-center">
              <Camera className="w-10 h-10 text-amber-400 mb-2 opacity-80" />
              <p className="text-xs text-slate-300 max-w-xs mb-3">{cameraError}</p>
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5"
              >
                <Keyboard className="w-4 h-4" />
                <span>Digitar Código Manualmente</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Samples Section (Very useful for rapid testing) */}
        {quickSamples && quickSamples.length > 0 && (
          <div className="w-full max-w-md mt-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
              ⚡ Toque para Simular Leitura Rápida:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {quickSamples.map((sample) => (
                <button
                  key={sample.value}
                  type="button"
                  onClick={() => {
                    playBeep('scan', beepEnabled);
                    handleScannedResult(sample.value);
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg text-left transition-all text-xs"
                >
                  <div className="font-bold text-slate-200 truncate">{sample.label}</div>
                  <div className="font-mono text-[10px] text-amber-400 truncate">{sample.value}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manual Input Toggle & Drawer */}
        <div className="w-full max-w-md mt-3">
          {!showManualInput ? (
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="w-full py-2 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 flex items-center justify-center space-x-2 border border-slate-700"
            >
              <Keyboard className="w-4 h-4 text-amber-400" />
              <span>Digitar ou Colar Código</span>
            </button>
          ) : (
            <form onSubmit={handleManualSubmit} className="bg-slate-900 border border-slate-700 p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">Entrada Manual de Código:</label>
                <button
                  type="button"
                  onClick={() => setShowManualInput(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-200"
                >
                  Ocultar
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  // Código de barras (EAN) é só número: abre o teclado numérico no celular
                  inputMode={mode === 'barcode' ? 'numeric' : 'text'}
                  pattern={mode === 'barcode' ? '[0-9]*' : undefined}
                  enterKeyHint="done"
                  autoComplete="off"
                  onChange={(e) =>
                    setManualCode(mode === 'barcode' ? e.target.value.replace(/\D/g, '') : e.target.value)
                  }
                  placeholder={mode === 'qrcode' ? 'Cole o conteúdo do QR Code...' : 'Digite o EAN'}
                  autoFocus
                  className="flex-1 min-w-0 h-14 px-4 bg-slate-950 border-2 border-slate-700 rounded-xl text-white font-mono text-lg tracking-wider placeholder:text-slate-500 placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="h-14 px-5 bg-amber-500 disabled:opacity-40 hover:bg-amber-400 active:scale-95 text-slate-950 font-black rounded-xl text-base flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Validar</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
