import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from './icons/XMarkIcon';
import { CameraIcon } from './icons/CameraIcon';
import { QrCodeIcon } from './icons/QrCodeIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';
import {
  scanBarcodeOrQrFromImage,
  decodeAnyBarcodeOrQrFromCanvas,
  compressImageForOcr,
  parseNfceTextContent,
  ParsedReceiptData
} from '../services/receiptScanner';

interface CameraReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  onCapturePhoto?: (base64Image: string) => void;
  onParsedReceipt?: (data: ParsedReceiptData) => void;
}

export const CameraReceiptModal: React.FC<CameraReceiptModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  onCapturePhoto,
  onParsedReceipt
}) => {
  const [mode, setMode] = useState<'qrcode' | 'pasteText' | 'manualKey'>('qrcode');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [scannedCodeFeedback, setScannedCodeFeedback] = useState<{ text: string; isBarcode: boolean } | null>(null);
  const [manualAccessKey, setManualAccessKey] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [isScanningFrame, setIsScanningFrame] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);
  const isDecodingRef = useRef(false);

  // Lock body scroll when camera modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

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
    isDecodingRef.current = false;
    setIsStreaming(false);
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (deviceId?: string) => {
    stopStream();
    setErrorMsg(null);

    try {
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

        // Check if torch/flashlight is supported
        const track = stream.getVideoTracks()[0];
        const capabilities: any = track.getCapabilities?.() || {};
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }

      // Enumerate devices to populate camera selector
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
        message = 'Permissão de câmera negada. Libere a câmera nas configurações do navegador ou utilize o upload de foto.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'Nenhuma câmera encontrada no dispositivo.';
      } else if (err.name === 'NotReadableError') {
        message = 'A câmera já está sendo usada por outro aplicativo ou aba.';
      }
      setErrorMsg(message);
    }
  }, [stopStream]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const newTorchState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: newTorchState }]
        });
        setTorchOn(newTorchState);
      } catch (err) {
        console.warn('Erro ao alternar lanterna:', err);
      }
    }
  };

  // Continuous Barcode & QR scan loop using multi-format detector
  const scanQrFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || mode !== 'qrcode' || isDecodingRef.current) {
      if (mode === 'qrcode' && !isDecodingRef.current) {
        animationFrameId.current = requestAnimationFrame(scanQrFrame);
      }
      return;
    }

    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        let w = video.videoWidth;
        let h = video.videoHeight;
        if (w > 1200) {
          h = Math.round((h * 1200) / w);
          w = 1200;
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);

        isDecodingRef.current = true;
        try {
          const detectedText = await decodeAnyBarcodeOrQrFromCanvas(canvas, ctx);

          if (detectedText && detectedText.trim().length > 0) {
            const clean = detectedText.trim();
            const isBarcode = /^\d{12,44}$/.test(clean.replace(/[\s.-]/g, ''));
            console.log(`📷 [CAMERA MODAL] ${isBarcode ? 'Código de barras' : 'QR Code'} detectado em vídeo:`, clean);
            
            setScannedCodeFeedback({
              text: clean,
              isBarcode
            });

            try {
              if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
              }
            } catch {
              // ignore
            }

            setTimeout(() => {
              stopStream();
              onScanSuccess(clean);
            }, 300);
            return;
          }
        } catch (e) {
          // ignore scan error and continue
        } finally {
          isDecodingRef.current = false;
        }
      }
    }

    // Continue scanning next animation frame
    animationFrameId.current = requestAnimationFrame(scanQrFrame);
  }, [mode, onScanSuccess, stopStream]);

  // Handle open/close and mode changes
  useEffect(() => {
    if (isOpen) {
      if (mode !== 'manualKey') {
        startCamera(selectedDeviceId || undefined);
      } else {
        stopStream();
      }
    } else {
      stopStream();
      setScannedCodeFeedback(null);
    }

    return () => {
      stopStream();
    };
  }, [isOpen, mode, startCamera, stopStream]);

  // Start frame loop when streaming in qrcode mode
  useEffect(() => {
    if (isOpen && isStreaming && mode === 'qrcode') {
      animationFrameId.current = requestAnimationFrame(scanQrFrame);
    } else if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  }, [isOpen, isStreaming, mode, scanQrFrame]);

  // Switch camera device
  const handleSwitchCamera = (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    startCamera(newDeviceId);
  };

  // Barcode / QR scan from uploaded picture
  const handleScanFromImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      console.log('🖼️ [CAMERA MODAL] Processando imagem para detectar Código de Barras ou QR Code...');
      const codeData = await scanBarcodeOrQrFromImage(file);
      if (codeData) {
        console.log('✅ [CAMERA MODAL] Código decodificado da foto do arquivo:', codeData);
        stopStream();
        onScanSuccess(codeData);
      } else if (onCapturePhoto) {
        // If not a recognized barcode, prompt user to read photo with AI
        const proceedWithAi = confirm('Não foi possível ler o código de barras diretamente na foto. Deseja que a Inteligência Artificial leia todos os dados e itens da nota fiscal nesta foto?');
        if (proceedWithAi) {
          console.log('🤖 [CAMERA MODAL] Usuário optou por processar foto via IA...');
          const compressed = await compressImageForOcr(file, 1600, 0.82);
          stopStream();
          onCapturePhoto(compressed);
        }
      } else {
        console.warn('⚠️ [CAMERA MODAL] Nenhum código de barras ou QR code detectado na imagem enviada.');
        alert('Nenhum código de barras ou QR Code legível foi detectado na imagem selecionada. Tente com outra foto mais nítida ou aproximada.');
      }
    } catch (err) {
      console.error('❌ [CAMERA MODAL] Erro ao processar imagem:', err);
      alert('Erro ao processar imagem.');
    } finally {
      if (fileUploadInputRef.current) fileUploadInputRef.current.value = '';
    }
  };

  // Paste text submission (from SEFAZ portal or text)
  const handleSubmitPastedText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) {
      alert('Cole o texto copiado da consulta da nota fiscal ou da SEFAZ.');
      return;
    }
    console.log('📋 [CAMERA MODAL] Processando texto colado do cupom/SEFAZ...');
    const parsed = parseNfceTextContent(pastedText);
    console.log('📋 [CAMERA MODAL] Itens extraídos do texto colado:', parsed);
    stopStream();
    if (onParsedReceipt) {
      onParsedReceipt(parsed);
    } else {
      onScanSuccess(pastedText);
    }
  };

  // Manual key / URL submission
  const handleSubmitManualKey = (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = manualAccessKey.trim();
    console.log('⌨️ [CAMERA MODAL] Entrada manual submetida:', inputVal);

    if (inputVal.startsWith('http://') || inputVal.startsWith('https://')) {
      console.log('🔗 [CAMERA MODAL] URL completa detectada na aba Chave:', inputVal);
      stopStream();
      onScanSuccess(inputVal);
      return;
    }

    const clean = inputVal.replace(/[\s.-]/g, '');
    if (clean.length < 20) {
      alert('Por favor, informe a Chave de Acesso da nota fiscal (44 números) ou o link completo do QR Code.');
      return;
    }
    stopStream();
    // If it's a 44 digit key, construct the SP QR Code query URL for direct extraction
    if (clean.length === 44 && clean.startsWith('35')) {
      const generatedUrl = `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${clean}|2|1|1|`;
      console.log('🔄 [CAMERA MODAL] Chave de 44 dígitos convertida para URL SP:', generatedUrl);
      onScanSuccess(generatedUrl);
    } else {
      console.log('🔑 [CAMERA MODAL] Chave pura enviada para o scanner:', clean);
      onScanSuccess(clean);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 overflow-hidden animate-fade-in">
      {/* Hidden canvas for video processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for barcode / QR image upload fallback */}
      <input
        type="file"
        ref={fileUploadInputRef}
        onChange={handleScanFromImageFile}
        accept="image/*"
        className="hidden"
      />

      <div className="bg-white dark:bg-gray-800 rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-rose-100 dark:border-gray-700 w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-lg overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div 
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
          className="p-4 sm:p-5 border-b border-rose-100 dark:border-gray-700 flex justify-between items-center bg-rose-50/60 dark:bg-gray-800/60 flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-primary text-white rounded-2xl shadow-md shadow-rose-500/20">
              {mode === 'qrcode' ? (
                <QrCodeIcon className="w-5 h-5" />
              ) : mode === 'pasteText' ? (
                <span className="font-bold text-sm">📋</span>
              ) : (
                <span className="font-bold text-sm font-mono">44#</span>
              )}
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-brand-text dark:text-rose-100">
                {mode === 'qrcode'
                  ? 'Scanner de Código de Barras & QR'
                  : mode === 'pasteText'
                  ? 'Colar Texto da Consulta SEFAZ'
                  : 'Chave de Acesso da Nota'}
              </h2>
              <p className="text-xs text-brand-light-text dark:text-gray-400">
                {mode === 'qrcode'
                  ? 'Aponte a câmera para o Código de Barras (DANFE) ou QR Code'
                  : mode === 'pasteText'
                  ? 'Cole o texto copiado da página do governo / SEFAZ'
                  : '44 dígitos numéricos impressos na nota'}
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

        {/* Mode Selector (3 options: QR / Código de Barras, Colar Texto, Chave) */}
        <div className="grid grid-cols-3 bg-rose-50 dark:bg-gray-900/60 p-1 mx-3 sm:mx-4 mt-3 rounded-2xl border border-rose-100 dark:border-gray-700 gap-1 text-[11px] sm:text-xs">
          <button
            type="button"
            onClick={() => setMode('qrcode')}
            className={`py-2 px-1 rounded-xl font-bold flex items-center justify-center gap-1 transition ${
              mode === 'qrcode'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-brand-light-text dark:text-gray-400 hover:text-brand-text'
            }`}
          >
            <QrCodeIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Câmera / Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('pasteText')}
            className={`py-2 px-1 rounded-xl font-bold flex items-center justify-center gap-1 transition ${
              mode === 'pasteText'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-brand-light-text dark:text-gray-400 hover:text-brand-text'
            }`}
          >
            <span>📋</span>
            <span className="truncate">Colar Texto</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('manualKey')}
            className={`py-2 px-1 rounded-xl font-bold flex items-center justify-center gap-1 transition ${
              mode === 'manualKey'
                ? 'bg-brand-primary text-white shadow-md'
                : 'text-brand-light-text dark:text-gray-400 hover:text-brand-text'
            }`}
          >
            <span className="font-mono font-black text-[10px]">44#</span>
            <span className="truncate">Chave</span>
          </button>
        </div>

        {/* Content Body */}
        {mode === 'pasteText' ? (
          <div className="p-4 sm:p-6 flex flex-col justify-center flex-1 bg-white dark:bg-gray-800 overflow-y-auto">
            <form onSubmit={handleSubmitPastedText} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-light-text dark:text-gray-300">
                    Copiar e Colar Texto da Consulta SEFAZ
                  </label>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    ⚡ Instantâneo
                  </span>
                </div>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={6}
                  placeholder={`Cole aqui o texto da página da SEFAZ. Exemplo:\nALPHA CENTRO COMERCIO DE DOCES\nCAIXA 1 CUPCAKE C TAMPA 1UND (Código: 7908015136574)\nQtde.:1 UN: UN Vl. Unit.: 2,15 Vl. Total 2,15\nFITA CETIM NAJAR COR 25 10MX22MM\nQtde.:1 UN: UN Vl. Unit.: 7,29 Vl. Total 7,29`}
                  className="w-full p-3.5 bg-rose-50/50 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-2xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-brand-primary outline-none"
                />
                <p className="text-xs text-brand-light-text dark:text-gray-400 mt-2">
                  Você pode selecionar o texto na tela de consulta da SEFAZ, copiar (Ctrl+C) e colar aqui. Todos os itens, quantidades e preços serão extraídos instantaneamente!
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-brand-primary hover:bg-rose-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-rose-500/25 transition flex items-center justify-center gap-2"
              >
                <span>Importar Produtos do Texto</span>
                <span>→</span>
              </button>
            </form>
          </div>
        ) : mode === 'manualKey' ? (
          <div className="p-4 sm:p-6 flex flex-col justify-center flex-1 bg-white dark:bg-gray-800 overflow-y-auto">
            <form onSubmit={handleSubmitManualKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-light-text dark:text-gray-300 mb-2">
                  Chave de Acesso (44 dígitos da DANFE / NFC-e / NF-e)
                </label>
                <textarea
                  value={manualAccessKey}
                  onChange={(e) => setManualAccessKey(e.target.value)}
                  rows={2}
                  placeholder="Ex: 3526 0708 9911 8200 0383 5500 4000 6845 6311 8934 2849"
                  className="w-full p-3 bg-rose-50/50 dark:bg-gray-700 border border-rose-200 dark:border-gray-600 rounded-2xl text-sm font-mono font-medium focus:ring-2 focus:ring-brand-primary outline-none"
                />
                
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-200 space-y-1">
                  <p className="font-bold">💡 Dica para ler todos os itens da nota:</p>
                  <p>
                    Para extrair a lista completa de produtos comprados:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 mt-1">
                    <li>Envie a <strong>foto/arquivo da nota DANFE</strong> na aba de Compras para a IA ler todos os produtos automaticamente</li>
                    <li>Ou envie o <strong>arquivo XML da NF-e</strong></li>
                    <li>Ou cole o texto copiado do site da SEFAZ na aba <strong>Colar Texto</strong></li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {manualAccessKey.replace(/[\s.-]/g, '').length >= 40 && (
                  <a
                    href={`https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=XbSeqxE8pl8=&chaveNFe=${manualAccessKey.replace(/[\s.-]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition flex items-center justify-center gap-1.5 text-center"
                  >
                    <span>Consultar no Portal Nacional ↗</span>
                  </a>
                )}
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-brand-primary hover:bg-rose-600 text-white font-bold text-xs rounded-2xl shadow-lg shadow-rose-500/25 transition"
                >
                  Continuar com a Chave
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Camera Feed Viewport */
          <div className="relative p-3 sm:p-4 flex flex-col items-center justify-center flex-1 min-h-[300px] sm:min-h-[360px] bg-gray-950">
            {errorMsg ? (
              <div className="text-center p-6 bg-rose-950/40 rounded-2xl border border-rose-800 text-rose-300 max-w-sm">
                <p className="font-bold text-sm mb-2">Câmera Indisponível</p>
                <p className="text-xs mb-4 text-rose-200">{errorMsg}</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => startCamera(selectedDeviceId || undefined)}
                    className="py-2.5 px-4 bg-brand-primary hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition"
                  >
                    Tentar Novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => fileUploadInputRef.current?.click()}
                    className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    Carregar Foto da Nota / Código de Barras
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('manualKey')}
                    className="py-2.5 px-4 bg-rose-900/30 text-rose-200 rounded-xl text-xs font-semibold"
                  >
                    Digitar Chave de Acesso Manualmente
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

                {/* Torch toggle button if supported */}
                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`absolute top-3 right-3 p-2.5 rounded-full shadow-lg transition z-10 ${
                      torchOn ? 'bg-amber-400 text-gray-950' : 'bg-black/60 text-white hover:bg-black/80'
                    }`}
                    title="Alternar Lanterna"
                  >
                    🔦
                  </button>
                )}

                {/* Scanning Crosshairs & Frame Guide for Barcodes and QR Codes */}
                <div className="pointer-events-none absolute inset-0 m-6 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-8 h-8 border-t-4 border-l-4 border-rose-500 rounded-tl-lg" />
                    <div className="w-8 h-8 border-t-4 border-r-4 border-rose-500 rounded-tr-lg" />
                  </div>

                  {/* Red Laser Scanning Bar for Linear Barcode and QR */}
                  <div className="relative flex flex-col items-center justify-center w-full my-auto">
                    <div className="w-full border-t border-dashed border-rose-400/40 my-2" />
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_rgba(244,63,94,1)] animate-pulse" />
                    <div className="w-full border-b border-dashed border-rose-400/40 my-2" />
                    <span className="text-[10px] uppercase font-mono tracking-widest text-rose-300 bg-black/60 px-2 py-0.5 rounded-full mt-1">
                      Alinhe o Código de Barras ou QR Code
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <div className="w-8 h-8 border-b-4 border-l-4 border-rose-500 rounded-bl-lg" />
                    <div className="w-8 h-8 border-b-4 border-r-4 border-rose-500 rounded-br-lg" />
                  </div>
                </div>

                {/* Success Badge Feedback */}
                {scannedCodeFeedback && (
                  <div className="absolute inset-0 bg-emerald-600/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 animate-fade-in z-20">
                    <div className="w-12 h-12 rounded-full bg-white text-emerald-600 flex items-center justify-center font-bold text-2xl mb-2 shadow-lg">
                      ✓
                    </div>
                    <p className="font-bold text-sm">
                      {scannedCodeFeedback.isBarcode ? 'Código de Barras Lido!' : 'QR Code Lido com Sucesso!'}
                    </p>
                    <p className="text-[11px] font-mono text-emerald-100 mt-1 max-w-[260px] truncate text-center bg-emerald-950/40 px-2 py-1 rounded">
                      {scannedCodeFeedback.text}
                    </p>
                    <p className="text-[10px] text-emerald-200 mt-1">Processando nota fiscal...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer Controls */}
        <div 
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}
          className="p-3 sm:p-4 bg-white dark:bg-gray-800 border-t border-rose-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0"
        >
          {/* Camera switcher or image fallback */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {mode !== 'manualKey' && devices.length > 1 ? (
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
                Carregar foto da galeria
              </button>
            )}
          </div>

          {/* Action Trigger */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
    </div>,
    document.body
  );
};
