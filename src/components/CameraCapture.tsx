import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Check, RefreshCw, Upload, Sparkles, Image as ImageIcon } from 'lucide-react';

interface CameraCaptureProps {
  title: string;
  subtitle?: string;
  onCapture: (base64Image: string) => void;
  onClose: () => void;
  presetType?: 'truck_front' | 'truck_back_seal' | 'pallet_cargo';
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  title,
  subtitle,
  onCapture,
  onClose,
  presetType = 'pallet_cargo',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let isMounted = true;

    async function initCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!isMounted) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        currentStream = s;
        setStream(s);
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Unable to access camera directly:', err);
        setCameraActive(false);
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode]);

  const captureFrame = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Add watermark timestamp
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(10, canvas.height - 35, 320, 25);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`CargaCheck • ${new Date().toLocaleString('pt-BR')}`, 18, canvas.height - 18);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPreviewImage(dataUrl);
      }
    } catch (err) {
      console.error('Error capturing frame:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setPreviewImage(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Preset demo generator in case device has no camera or running in desktop sandbox
  const generateSimulatedPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (presetType === 'truck_front') {
      // Draw truck front illustration
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#3b82f6';
      ctx.roundRect?.(120, 80, 400, 300, 16);
      ctx.fill();
      // Windshield
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(160, 110, 320, 120);
      // License plate
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(240, 320, 160, 45);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('BRA-2E19', 265, 352);
    } else if (presetType === 'truck_back_seal') {
      // Draw truck rear doors with seal
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 640, 480);
      // Doors line
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 6;
      ctx.strokeRect(60, 40, 520, 380);
      ctx.beginPath();
      ctx.moveTo(320, 40);
      ctx.lineTo(320, 420);
      ctx.stroke();
      // Seal
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(320, 240, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('LACRE OK', 290, 245);
    } else {
      // Pallet Cargo
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 640, 480);
      // Pallet wood
      ctx.fillStyle = '#b45309';
      ctx.fillRect(100, 380, 440, 40);
      // Boxes
      const colors = ['#f59e0b', '#d97706', '#b45309', '#92400e'];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          ctx.fillStyle = colors[(r + c) % colors.length];
          ctx.fillRect(120 + c * 100, 350 - r * 70, 90, 60);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`LOTE-26`, 135 + c * 100, 385 - r * 70);
        }
      }
    }

    // Watermark
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 445, 640, 35);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`REGISTRO FOTOGRÁFICO WMS • ${new Date().toLocaleString('pt-BR')}`, 20, 468);

    setPreviewImage(canvas.toDataURL('image/jpeg', 0.9));
  };

  const confirmPhoto = () => {
    if (previewImage) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      onCapture(previewImage);
    }
  };

  const retakePhoto = () => {
    setPreviewImage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white backdrop-blur-md">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div>
          <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
            <Camera className="w-4 h-4 text-amber-400" />
            <span>{title}</span>
          </h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            if (stream) stream.getTracks().forEach((t) => t.stop());
            onClose();
          }}
          className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 overflow-hidden">
        <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden bg-black border-2 border-slate-700 shadow-2xl flex items-center justify-center">
          {previewImage ? (
            <img src={previewImage} alt="Captura" className="w-full h-full object-cover" />
          ) : cameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-6 text-center text-slate-400 space-y-3">
              <ImageIcon className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-xs">Câmera indisponível. Carregue uma imagem ou gere uma simulação fotográfica.</p>
            </div>
          )}

          {/* Guidelines Overlay */}
          {!previewImage && cameraActive && (
            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-white/20 m-6 rounded-xl flex items-end justify-center pb-3">
              <span className="bg-slate-950/70 text-slate-300 text-[11px] px-3 py-1 rounded-full">
                Enquadre o veículo ou carga
              </span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="w-full max-w-md mt-4 space-y-3">
          {previewImage ? (
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={retakePhoto}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-sm flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tirar Outra</span>
              </button>
              <button
                type="button"
                onClick={confirmPhoto}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/40"
              >
                <Check className="w-5 h-5" />
                <span>Confirmar Foto</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Galeria ou Arquivo"
                  className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700"
                >
                  <Upload className="w-5 h-5" />
                </button>

                {cameraActive && (
                  <button
                    type="button"
                    onClick={captureFrame}
                    className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 border-4 border-slate-900"
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-slate-950 flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                  </button>
                )}

                {cameraActive && (
                  <button
                    type="button"
                    onClick={() => setFacingMode((p) => (p === 'environment' ? 'user' : 'environment'))}
                    title="Inverter Câmera"
                    className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-700"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Quick Simulator button */}
              <button
                type="button"
                onClick={generateSimulatedPhoto}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-medium text-amber-400 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Simular Foto de {presetType === 'truck_front' ? 'Veículo (Frente)' : presetType === 'truck_back_seal' ? 'Lacre / Traseira' : 'Pallet de Carga'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
