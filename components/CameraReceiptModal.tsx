import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { XMarkIcon } from './icons/XMarkIcon';
import { CameraIcon } from './icons/CameraIcon';
import { QrCodeIcon } from './icons/QrCodeIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';
import { scanQrFromImage } from '../services/receiptScanner';

interface CameraReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  onCapturePhoto?: (base64Image: string) => void;
}

export const CameraReceiptModal: React.FC<CameraReceiptModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  onCapturePhoto
}) => {
  const [mode, setMode] = useState<'qrcode' | 'photo'>('qrcode');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [scannedCodeFeedback, setScannedCodeFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Stop active camera stream
  const stopStream = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    stopStream();
    setErrorMsg(null);

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador não possui suporte para acesso direto à câmera.');
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }

      // Enumerate devices to populate camera selector if not already done
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoDevices);
      if (!deviceId && videoDevices.length > 0) {
        const activeTrack = stream.getVideoTracks()[0];
        const activeId = activeTrack?.getSettings()?.deviceId || videoDevices[0].deviceId;
        setSelectedDeviceId(activeId);
      }
    } catch (err: any) {
      console.error('Erro ao inicializar câmera:', err);
      let message = 'Não foi possível acessar a câmera do dispositivo.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Permissão de câmera negada. Por favor, libere a câmera nas configurações do navegador ou use o botão de subir foto.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'Nenhuma câmera encontrada no dispositivo.';
      } else if (err.name === 'NotReadableError') {
        message = 'A câmera já está sendo usada por outro aplicativo ou aba.';
      }
      setErrorMsg(message);
    }
  }, [stopStream]);

  // Continuous QR scan loop using jsQR
  const scanQrFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || mode !== 'qrcode') {
      return;
    }

    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (code && code.data && code.data.trim().length > 0) {
          // Found QR Code!
          setScannedCodeFeedback(code.data);
          try {
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
          } catch (e) {
            // ignore
          }

          setTimeout(() => {
            stopStream();
            onScanSuccess(code.data);
          }, 300);
          return;
        }
      }
    }

    // Continue scanning next animation frame
    animationFrameId.current = requestAnimationFrame(scanQrFrame);
  }, [mode, onScanSuccess, stopStream]);

  // Handle open/close and mode changes
  useEffect(() => {
    if (isOpen) {
      startCamera(selectedDeviceId || undefined);
    } else {
      stopStream();
      setScannedCodeFeedback(null);
    }

    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]);

  // Start frame loop when streaming in qrcode mode
  useEffect(() => {
    if (isOpen && isStreaming && mode === 'qrcode') {
      animationFrameId.current = requestAnimationFrame(scanQrFrame);
    } else if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  }, [isOpen, isStreaming, mode, scanQrFrame]);

  // Snapshot capture for AI reading
  const handleTakeSnapshot = () => {
    if (!videoRef.current || !onCapturePhoto) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
      stopStream();
      onCapturePhoto(base64);
    }
  };

  // Switch camera device
  const handleSwitchCamera = (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    startCamera(newDeviceId);
  };

  // QR scan from uploaded picture fallback
  const handleScanFromImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const qrData = await scanQrFromImage(file);
      if (qrData) {
        stopStream();
        onScanSuccess(qrData);
      } else {
        alert('Nenhum QR Code legível foi detectado na imagem selecionada. Tente com outra foto mais nítida.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao processar imagem para QR Code.');
    } finally {
      if (fileUploadInputRef.current) fileUploadInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      {/* Hidden canvas for video processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for QR code image upload fallback */}
      <input
        type="file"
        ref={fileUploadInputRef}
        onChange={handleScanFromImageFile}
        accept="image/*"
        className="hidden"
      />

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-rose-100 dark:border-gray-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-rose-100 dark:border-gray-700 flex justify-between items-center bg-rose-50/60 dark:bg-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-primary text-white rounded-2xl shadow-md shadow-rose-500/20">
              {mode === 'qrcode' ? <QrCodeIcon className="w-5 h-5" /> : <CameraIcon className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-brand-text dark:text-rose-100">
                {mode === 'qrcode' ? 'Scanner de QR Code NFC-e' : 'Fotografar Cupom Fiscal'}
              </h2>
              <p className="text-xs text-brand-light-text dark:text-gray-400">
                {mode === 'qrcode'
                  ? 'Aponte a câmera para o QR Code da nota fiscal'
                  : 'Enquadre o cupom completo para extração via IA'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-rose-100 dark:hover:bg-gray-700 transition"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex bg-rose-50 dark:bg-gray-900/60 p-1 mx-4 mt-3 rounded-2xl border border-rose-100 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setMode('qrcode')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
              mode === 'qrcode'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-brand-light-text dark:text-gray-400 hover:text-brand-text'
            }`}
          >
            <QrCodeIcon className="w-4 h-4" />
            Ler QR Code (NFC-e)
          </button>
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
              mode === 'photo'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-brand-light-text dark:text-gray-400 hover:text-brand-text'
            }`}
          >
            <CameraIcon className="w-4 h-4" />
            Fotografar Cupom (IA)
          </button>
        </div>

        {/* Camera Feed Viewport */}
        <div className="relative p-4 flex flex-col items-center justify-center flex-1 min-h-[300px] sm:min-h-[360px] bg-gray-950">
          {errorMsg ? (
            <div className="text-center p-6 bg-rose-950/40 rounded-2xl border border-rose-800 text-rose-300 max-w-sm">
              <p className="font-bold text-sm mb-2">Câmera Indisponível</p>
              <p className="text-xs mb-4 text-rose-200">{errorMsg}</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => startCamera(selectedDeviceId || undefined)}
                  className="py-2 px-4 bg-brand-primary hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition"
                >
                  Tentar Novamente
                </button>
                <button
                  type="button"
                  onClick={() => fileUploadInputRef.current?.click()}
                  className="py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  Carregar Imagem com QR Code
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-full rounded-2xl overflow-hidden bg-black aspect-[3/4] max-w-[340px] flex items-center justify-center shadow-2xl border border-gray-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Scanning Crosshairs & Frame Guide */}
              <div className="pointer-events-none absolute inset-0 m-6 flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-8 h-8 border-t-4 border-l-4 border-rose-500 rounded-tl-lg" />
                  <div className="w-8 h-8 border-t-4 border-r-4 border-rose-500 rounded-tr-lg" />
                </div>

                {mode === 'qrcode' && (
                  <div className="relative flex items-center justify-center">
                    {/* Animated scanning laser line */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_rgba(244,63,94,0.9)] animate-pulse" />
                  </div>
                )}

                <div className="flex justify-between">
                  <div className="w-8 h-8 border-b-4 border-l-4 border-rose-500 rounded-bl-lg" />
                  <div className="w-8 h-8 border-b-4 border-r-4 border-rose-500 rounded-br-lg" />
                </div>
              </div>

              {/* Success Badge Feedback */}
              {scannedCodeFeedback && (
                <div className="absolute inset-0 bg-emerald-600/70 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-white text-emerald-600 flex items-center justify-center font-bold text-2xl mb-2 shadow-lg">
                    ✓
                  </div>
                  <p className="font-bold text-sm">QR Code Lido com Sucesso!</p>
                  <p className="text-[11px] text-emerald-100 mt-1">Carregando dados da nota...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-rose-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Camera switcher or image fallback */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {devices.length > 1 ? (
              <select
                value={selectedDeviceId}
                onChange={(e) => handleSwitchCamera(e.target.value)}
                className="text-xs bg-rose-50 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl py-2 px-3 font-semibold text-brand-text dark:text-gray-200 outline-none"
              >
                {devices.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Câmera ${idx + 1}`}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => fileUploadInputRef.current?.click()}
                className="text-xs text-brand-primary dark:text-rose-300 hover:underline flex items-center gap-1 font-semibold"
              >
                <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                Ler QR de imagem salva
              </button>
            )}
          </div>

          {/* Action Trigger */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {mode === 'photo' && (
              <button
                type="button"
                onClick={handleTakeSnapshot}
                disabled={!isStreaming}
                className="flex-1 sm:flex-initial py-3 px-6 bg-brand-primary hover:bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-500/30 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <CameraIcon className="w-5 h-5" />
                <span>Fotografar e Ler com IA</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopStream();
                onClose();
              }}
              className="py-2.5 px-4 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-brand-text dark:hover:text-white rounded-xl hover:bg-rose-50 dark:hover:bg-gray-700 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
