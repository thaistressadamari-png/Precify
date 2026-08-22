import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { XMarkIcon } from './icons/XMarkIcon';
import { CameraIcon } from './icons/CameraIcon';
import { QrCodeIcon } from './icons/QrCodeIcon';

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
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'qrcode' | 'photo'>('qrcode');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopAll();
      return;
    }

    // Initialize camera listing
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera on mobile
          const backCamera = devices.find(
            (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('traseira') || d.label.toLowerCase().includes('environment')
          );
          setActiveCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          setErrorMsg('Nenhuma câmera encontrada no dispositivo.');
        }
      })
      .catch((err) => {
        console.error('Erro ao listar câmeras:', err);
        setErrorMsg('Permissão de câmera não concedida ou dispositivo indisponível.');
      });

    return () => {
      stopAll();
    };
  }, [isOpen]);

  // Start QR Scanner when activeCameraId or mode changes
  useEffect(() => {
    if (!isOpen || !activeCameraId) return;

    if (mode === 'qrcode') {
      startQrScanner(activeCameraId);
    } else {
      stopQrScanner();
      startPhotoCamera(activeCameraId);
    }

    return () => {
      stopAll();
    };
  }, [isOpen, activeCameraId, mode]);

  const startQrScanner = async (cameraId: string) => {
    try {
      stopPhotoCamera();
      setErrorMsg(null);

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          // ignore
        }
      }

      const qrScanner = new Html5Qrcode('qr-reader-container', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A
        ],
        verbose: false
      });

      html5QrCodeRef.current = qrScanner;

      await qrScanner.start(
        cameraId,
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          // QR/Barcode scanned successfully
          stopAll();
          onScanSuccess(decodedText);
        },
        () => {
          // Frame error / scanning tick - normal
        }
      );
      setScanning(true);
    } catch (err: any) {
      console.error('Falha ao iniciar scanner QR:', err);
      setErrorMsg('Não foi possível iniciar o scanner da câmera.');
      setScanning(false);
    }
  };

  const stopQrScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Erro ao parar scanner QR', e);
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  const startPhotoCamera = async (cameraId: string) => {
    try {
      stopQrScanner();
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: cameraId },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Erro ao abrir câmera para foto:', err);
      // Fallback without deviceId
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (e) {
        setErrorMsg('Erro ao acessar a câmera para captura de foto.');
      }
    }
  };

  const stopPhotoCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const stopAll = () => {
    stopQrScanner();
    stopPhotoCamera();
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current || !onCapturePhoto) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      stopAll();
      onCapturePhoto(base64);
    }
  };

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setActiveCameraId(cameras[nextIndex].id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-rose-100 dark:border-gray-700 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-rose-100 dark:border-gray-700 flex justify-between items-center bg-rose-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary rounded-xl">
              {mode === 'qrcode' ? <QrCodeIcon className="w-6 h-6" /> : <CameraIcon className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-brand-text dark:text-rose-100">
                {mode === 'qrcode' ? 'Ler QR Code / Código de Barras' : 'Fotografar Cupom Fiscal'}
              </h2>
              <p className="text-xs text-brand-light-text dark:text-gray-400">
                {mode === 'qrcode'
                  ? 'Aponte para o QR Code da NFC-e ou Código de Barras'
                  : 'Enquadre a nota e tire a foto para leitura automática por IA'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAll();
              onClose();
            }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-rose-100/50 dark:hover:bg-gray-700 transition"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Mode Selector Switch */}
        <div className="flex bg-rose-50/80 dark:bg-gray-900/50 p-1.5 mx-4 mt-4 rounded-xl border border-rose-100 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setMode('qrcode')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition ${
              mode === 'qrcode'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-brand-light-text dark:text-gray-400 hover:text-brand-text'
            }`}
          >
            <QrCodeIcon className="w-4 h-4" />
            Scanner QR Code
          </button>
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition ${
              mode === 'photo'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-brand-light-text dark:text-gray-400 hover:text-brand-text'
            }`}
          >
            <CameraIcon className="w-4 h-4" />
            Fotografar Cupom (OCR IA)
          </button>
        </div>

        {/* Camera Feed / QR Reader Container */}
        <div className="relative p-4 flex flex-col items-center justify-center min-h-[340px]">
          {errorMsg ? (
            <div className="text-center p-6 bg-rose-50 dark:bg-gray-700/50 rounded-2xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-300">
              <p className="font-semibold mb-2">Acesso à câmera indisponível</p>
              <p className="text-xs mb-4">{errorMsg}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Dica: você também pode subir uma foto ou arquivo da nota diretamente pela opção "Subir Foto".
              </p>
            </div>
          ) : (
            <div className="relative w-full rounded-2xl overflow-hidden bg-black aspect-square max-w-[320px] sm:max-w-[360px] flex items-center justify-center shadow-inner">
              {mode === 'qrcode' ? (
                <div id="qr-reader-container" className="w-full h-full" />
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}

              {/* Aim overlay for photo/qrcode */}
              <div className="pointer-events-none absolute inset-0 border-2 border-brand-primary/40 m-6 rounded-xl flex flex-col justify-between p-3">
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-brand-primary rounded-tl" />
                  <div className="w-4 h-4 border-t-2 border-r-2 border-brand-primary rounded-tr" />
                </div>
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-b-2 border-l-2 border-brand-primary rounded-bl" />
                  <div className="w-4 h-4 border-b-2 border-r-2 border-brand-primary rounded-br" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-rose-50/50 dark:bg-gray-800/50 border-t border-rose-100 dark:border-gray-700 flex items-center justify-between gap-3">
          {cameras.length > 1 && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="py-2.5 px-4 text-xs font-semibold text-brand-text dark:text-gray-200 bg-white dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-xl hover:bg-rose-50 dark:hover:bg-gray-600 transition flex items-center gap-2"
            >
              🔄 Trocar Câmera
            </button>
          )}

          {mode === 'photo' && (
            <button
              type="button"
              onClick={handleTakeSnapshot}
              className="flex-1 py-3 px-6 bg-brand-primary hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-500/30 transition flex items-center justify-center gap-2 text-sm"
            >
              <CameraIcon className="w-5 h-5" />
              Capturar e Ler Cupom
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              stopAll();
              onClose();
            }}
            className="py-2.5 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-brand-text transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
