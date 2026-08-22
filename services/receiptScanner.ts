import jsQR from 'jsqr';
import type { Ingredient, Packaging, InvoiceReceipt, InvoicePurchaseItem, Unit, PackagingUnit } from '../types';

export interface ParsedReceiptData {
  supplier: string;
  cnpj?: string;
  date: string;
  accessKey?: string;
  nfcNumber?: string;
  series?: string;
  totalAmount: number;
  paymentMethod?: string;
  items: Array<{
    rawName: string;
    code?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    category?: 'ingredient' | 'packaging';
    suggestedPackageAmount?: number;
    suggestedUnit?: Unit | PackagingUnit;
  }>;
}

// Fast client-side image compression to speed up OCR and network transfers from ~15MB to ~250KB
export const compressImageForOcr = async (
  imageFileOrBase64: File | string,
  maxDimension: number = 1600,
  quality: number = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D context não disponível');
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64Only = compressedDataUrl.split(',')[1];
        resolve(base64Only);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);

    if (typeof imageFileOrBase64 === 'string') {
      img.src = imageFileOrBase64.startsWith('data:')
        ? imageFileOrBase64
        : `data:image/jpeg;base64,${imageFileOrBase64}`;
    } else {
      img.src = URL.createObjectURL(imageFileOrBase64);
    }
  });
};

// Convert file or image to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Helper to run jsQR on image data with options
const tryDecodeImageData = (ctx: CanvasRenderingContext2D, width: number, height: number): string | null => {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth'
    });
    return code && code.data && code.data.trim().length > 0 ? code.data : null;
  } catch {
    return null;
  }
};

// Multi-pass high-accuracy QR code scanner for receipts and photos
export const scanQrFromImage = async (imageFileOrBase64: File | string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const originalWidth = img.width;
        const originalHeight = img.height;

        // Pass 1: Try multiple target scales (1000px, 600px, full scale)
        const targetScales = [1000, 600, 1400, originalWidth];
        for (const targetMax of targetScales) {
          let w = originalWidth;
          let h = originalHeight;
          if (w > targetMax || h > targetMax) {
            if (w > h) {
              h = Math.round((h * targetMax) / w);
              w = targetMax;
            } else {
              w = Math.round((w * targetMax) / h);
              h = targetMax;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) continue;

          ctx.drawImage(img, 0, 0, w, h);
          const found = tryDecodeImageData(ctx, w, h);
          if (found) {
            resolve(found);
            return;
          }

          // Pass 2: High contrast and binarization filter
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale
            const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            // High contrast stretch
            const contrast = (avg - 128) * 1.6 + 128;
            const finalVal = contrast > 130 ? 255 : 0; // threshold
            data[i] = finalVal;
            data[i + 1] = finalVal;
            data[i + 2] = finalVal;
          }
          ctx.putImageData(imgData, 0, 0);
          const foundBinarized = tryDecodeImageData(ctx, w, h);
          if (foundBinarized) {
            resolve(foundBinarized);
            return;
          }

          // Pass 3: Center & Bottom crop (receipt QR codes are usually centered or at the bottom)
          const cropH = Math.round(h * 0.6);
          const cropY = Math.round(h * 0.4);
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = w;
          cropCanvas.height = cropH;
          const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
          if (cropCtx) {
            cropCtx.drawImage(img, 0, cropY, w, cropH, 0, 0, w, cropH);
            const foundCrop = tryDecodeImageData(cropCtx, w, cropH);
            if (foundCrop) {
              resolve(foundCrop);
              return;
            }
          }
        }

        resolve(null);
      } catch (err) {
        console.warn('Erro ao decodificar QR na imagem:', err);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);

    if (typeof imageFileOrBase64 === 'string') {
      img.src = imageFileOrBase64.startsWith('data:') 
        ? imageFileOrBase64 
        : `data:image/jpeg;base64,${imageFileOrBase64}`;
    } else {
      img.src = URL.createObjectURL(imageFileOrBase64);
    }
  });
};

// Heuristic to detect if a product name is likely packaging vs ingredient
export const guessCategory = (name: string): 'ingredient' | 'packaging' => {
  const lower = name.toLowerCase();
  const packagingKeywords = [
    'embalag', 'caixa', 'sacola', 'saco', 'fita', 'laco', 'laço', 'pote', 'copo', 'tampa',
    'prato', 'bandeja', 'tabuleiro', 'forma', 'forminha', 'papel arroz', 'acetato', 'filme',
    'etiqueta', 'tag', 'adesivo', 'tubete', 'cake board', 'bobina', 'rolo', 'blister', 'canudo'
  ];
  return packagingKeywords.some(kw => lower.includes(kw)) ? 'packaging' : 'ingredient';
};

// Smart unit and package amount extractor (e.g. "NATA FRIMESA 300G" -> 300g, "LEITE CONDENSADO 395G" -> 395g)
export const guessPackageSpecs = (
  name: string,
  rawUnit: string,
  quantity: number,
  unitPrice: number,
  totalPrice: number
): { amount: number; unit: Unit | PackagingUnit; price: number } => {
  const lower = name.toLowerCase();
  const normalizedRawUnit = (rawUnit || '').trim().toLowerCase();

  // Look for grams in title (e.g., 300g, 395g, 500g, 100g, 1kg, 5kg, 1l, 900ml)
  const gramMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gramas)\b/);
  const kgMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|quilos?)\b/);
  const mlMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(ml|mls)\b/);
  const lMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(l|lt|litros?)\b/);
  const unMatch = lower.match(/(\d+)\s*(un|und|unid|unidades|pecas?|peças?)\b/);

  if (normalizedRawUnit === 'kg') {
    return {
      amount: quantity > 0 ? quantity : 1,
      unit: 'kg',
      price: totalPrice > 0 ? totalPrice : unitPrice
    };
  }

  if (gramMatch) {
    const val = parseFloat(gramMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      return {
        amount: val,
        unit: 'g',
        price: unitPrice > 0 ? unitPrice : (quantity > 0 ? totalPrice / quantity : totalPrice)
      };
    }
  }

  if (kgMatch) {
    const val = parseFloat(kgMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      return {
        amount: val * 1000,
        unit: 'g',
        price: unitPrice > 0 ? unitPrice : totalPrice
      };
    }
  }

  if (mlMatch) {
    const val = parseFloat(mlMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      return {
        amount: val,
        unit: 'ml',
        price: unitPrice > 0 ? unitPrice : totalPrice
      };
    }
  }

  if (lMatch) {
    const val = parseFloat(lMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      return {
        amount: val * 1000,
        unit: 'ml',
        price: unitPrice > 0 ? unitPrice : totalPrice
      };
    }
  }

  if (unMatch) {
    const val = parseInt(unMatch[1], 10);
    if (!isNaN(val) && val > 0) {
      return {
        amount: val,
        unit: 'un',
        price: unitPrice > 0 ? unitPrice : totalPrice
      };
    }
  }

  // Default fallback based on raw unit
  if (['g', 'gr'].includes(normalizedRawUnit)) {
    return { amount: quantity > 0 ? quantity : 1000, unit: 'g', price: totalPrice > 0 ? totalPrice : unitPrice };
  }
  if (['l', 'lt', 'litro', 'litros'].includes(normalizedRawUnit)) {
    return { amount: quantity > 0 ? quantity : 1, unit: 'l', price: totalPrice > 0 ? totalPrice : unitPrice };
  }
  if (['ml'].includes(normalizedRawUnit)) {
    return { amount: quantity > 0 ? quantity : 1000, unit: 'ml', price: totalPrice > 0 ? totalPrice : unitPrice };
  }
  if (['m', 'metro', 'metros'].includes(normalizedRawUnit)) {
    return { amount: quantity > 0 ? quantity : 1, unit: 'm', price: totalPrice > 0 ? totalPrice : unitPrice };
  }
  if (['pct', 'pacote'].includes(normalizedRawUnit)) {
    return { amount: quantity > 0 ? quantity : 1, unit: 'pacote', price: totalPrice > 0 ? totalPrice : unitPrice };
  }
  if (['rolo'].includes(normalizedRawUnit)) {
    return { amount: quantity > 0 ? quantity : 1, unit: 'rolo', price: totalPrice > 0 ? totalPrice : unitPrice };
  }

  return {
    amount: quantity > 0 ? quantity : 1,
    unit: 'un',
    price: unitPrice > 0 ? unitPrice : (quantity > 0 ? totalPrice / quantity : totalPrice)
  };
};

// Parse NFC-e QR Code String or 44-digit Access Key (e.g. from camera scanner or manual entry)
export const parseNfceQrCode = (qrCodeString: string): Partial<ParsedReceiptData> => {
  const result: Partial<ParsedReceiptData> = {
    items: []
  };

  const rawClean = qrCodeString.replace(/[\s.-]/g, '');

  // Check for 44-digit access key inside URL or text or clean digits
  const accessKeyMatch = rawClean.match(/\b\d{44}\b/) || 
                         qrCodeString.match(/[?&]p=([0-9]{44})/i) || 
                         qrCodeString.match(/p=([0-9]{44})/i) || 
                         qrCodeString.match(/[?&]chNFe=([0-9]{44})/i) ||
                         qrCodeString.match(/chNFe=([0-9]{44})/i) ||
                         qrCodeString.match(/[?&]chave=([0-9]{44})/i) ||
                         (rawClean.length === 44 && /^\d+$/.test(rawClean) ? [rawClean, rawClean] : null);

  if (accessKeyMatch) {
    result.accessKey = accessKeyMatch[1] || accessKeyMatch[0];
    
    // Parse key parts (UF: 2, AAMM: 4, CNPJ: 14, Mod: 2, Serie: 3, Num: 9, Tipo: 1, Cod: 8, DV: 1)
    if (result.accessKey && result.accessKey.length === 44) {
      const yearMonth = result.accessKey.substring(2, 6); // e.g. 2608 -> 2026-08
      const year = '20' + yearMonth.substring(0, 2);
      const month = yearMonth.substring(2, 4);
      result.date = `${year}-${month}-01`;
      
      const rawCnpj = result.accessKey.substring(6, 20);
      result.cnpj = rawCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
      result.series = result.accessKey.substring(22, 25);
      result.nfcNumber = result.accessKey.substring(25, 34).replace(/^0+/, '');
    }
  }

  // Extract total amount if pipe-delimited SEFAZ standard format (p=chave|2|1|1|total_hex_or_dec...)
  const pipeParts = qrCodeString.split('|');
  if (pipeParts.length >= 5) {
    const possibleTotal = parseFloat(pipeParts[4]?.replace(',', '.'));
    if (!isNaN(possibleTotal) && possibleTotal > 0) {
      result.totalAmount = possibleTotal;
    }
  }

  // Check query parameter total (ex: &vNF=24.04 or &total=24.04)
  const vnfMatch = qrCodeString.match(/[?&](?:vNF|total|valor)=([0-9.,]+)/i);
  if (vnfMatch && !result.totalAmount) {
    const vnf = parseFloat(vnfMatch[1].replace(',', '.'));
    if (!isNaN(vnf)) result.totalAmount = vnf;
  }

  result.supplier = "Cupom Fiscal NFC-e";
  return result;
};

// Parse NF-e / NFC-e XML string directly
export const parseNfeXml = (xmlText: string): ParsedReceiptData => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const supplier = xmlDoc.querySelector("emit > xNome")?.textContent || 
                   xmlDoc.querySelector("emit > xFant")?.textContent || 
                   "Fornecedor / Supermercado";
  const cnpjRaw = xmlDoc.querySelector("emit > CNPJ")?.textContent || "";
  const cnpj = cnpjRaw ? cnpjRaw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : undefined;
  
  const dhEmi = xmlDoc.querySelector("ide > dhEmi")?.textContent || 
                xmlDoc.querySelector("ide > dEmi")?.textContent || "";
  const date = dhEmi ? dhEmi.substring(0, 10) : new Date().toISOString().substring(0, 10);
  
  const nfcNumber = xmlDoc.querySelector("ide > nNF")?.textContent || "";
  const series = xmlDoc.querySelector("ide > serie")?.textContent || "";
  
  const infNFe = xmlDoc.querySelector("infNFe");
  const accessKey = infNFe?.getAttribute("Id")?.replace(/^NFe/, "") || "";
  
  const vNF = xmlDoc.querySelector("total > ICMSTot > vNF")?.textContent || 
              xmlDoc.querySelector("vNF")?.textContent || "0";
  const totalAmount = parseFloat(vNF) || 0;

  const tPagMap: Record<string, string> = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão de Crédito',
    '04': 'Cartão de Débito',
    '05': 'Crédito Loja',
    '10': 'Vale Alimentação',
    '11': 'Vale Refeição',
    '15': 'Boleto Bancário',
    '17': 'PIX',
    '99': 'Outros'
  };
  const tPag = xmlDoc.querySelector("detPag > tPag")?.textContent || 
               xmlDoc.querySelector("pag > tPag")?.textContent || "";
  const paymentMethod = tPagMap[tPag] || (tPag ? `Forma ${tPag}` : 'Não informado');

  const detNodes = xmlDoc.querySelectorAll("det");
  const items: ParsedReceiptData['items'] = [];

  detNodes.forEach(det => {
    const rawName = det.querySelector("prod > xProd")?.textContent || "Item sem descrição";
    const code = det.querySelector("prod > cProd")?.textContent || 
                 det.querySelector("prod > cEAN")?.textContent || "";
    const qCom = parseFloat(det.querySelector("prod > qCom")?.textContent || "1") || 1;
    const uCom = det.querySelector("prod > uCom")?.textContent || "UN";
    const vUnCom = parseFloat(det.querySelector("prod > vUnCom")?.textContent || "0") || 0;
    const vProd = parseFloat(det.querySelector("prod > vProd")?.textContent || "0") || (qCom * vUnCom);

    const category = guessCategory(rawName);
    const specs = guessPackageSpecs(rawName, uCom, qCom, vUnCom, vProd);

    items.push({
      rawName,
      code,
      quantity: qCom,
      unit: uCom,
      unitPrice: vUnCom > 0 ? vUnCom : (qCom > 0 ? vProd / qCom : vProd),
      totalPrice: vProd,
      category,
      suggestedPackageAmount: specs.amount,
      suggestedUnit: specs.unit
    });
  });

  return {
    supplier,
    cnpj,
    date,
    accessKey,
    nfcNumber,
    series,
    totalAmount,
    paymentMethod,
    items
  };
};

// Fetch & parse NFC-e URL from SEFAZ using server-side endpoint (/api/fetch-nfce-url)
export const fetchNfceFromUrl = async (url: string): Promise<ParsedReceiptData> => {
  console.log('📡 [RECEIPT SCANNER] Iniciando requisição para /api/fetch-nfce-url...');
  console.log('🔗 [RECEIPT SCANNER] URL do cupom:', url);
  let response: globalThis.Response;
  try {
    response = await fetch('/api/fetch-nfce-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });
  } catch (err: any) {
    console.error('❌ [RECEIPT SCANNER] Erro de rede ao chamar /api/fetch-nfce-url:', err);
    throw new Error('Não foi possível conectar ao servidor para consultar o QR Code da SEFAZ.');
  }

  console.log(`📡 [RECEIPT SCANNER] Resposta recebida da API: Status ${response.status}`);

  if (!response.ok) {
    let errorDetail = 'Falha ao consultar a nota fiscal no servidor da SEFAZ.';
    try {
      const errJson = await response.json();
      errorDetail = errJson.error || errorDetail;
    } catch {
      errorDetail = `Erro (${response.status}): ${response.statusText}`;
    }
    console.error('❌ [RECEIPT SCANNER] Erro retornado pela API da SEFAZ:', errorDetail);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log('✅ [RECEIPT SCANNER] Dados fiscais e itens obtidos com sucesso:', data);
  return data as ParsedReceiptData;
};

// Parse Receipt Photo / Document using Server-Side Gemini API Proxy (/api/parse-receipt)
export const parseReceiptImageWithGemini = async (imageBase64: string, mimeType: string = 'image/jpeg'): Promise<ParsedReceiptData> => {
  let response: globalThis.Response;
  
  // Compress image if large (e.g. > 500KB base64 string) to make network transfer instantaneous
  let payloadBase64 = imageBase64;
  try {
    if (payloadBase64.length > 300000) {
      payloadBase64 = await compressImageForOcr(imageBase64, 1600, 0.82);
    }
  } catch (compErr) {
    console.warn('Erro ao comprimir imagem localmente, enviando original:', compErr);
  }

  try {
    response = await fetch('/api/parse-receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageBase64: payloadBase64,
        mimeType: 'image/jpeg'
      })
    });
  } catch (netErr: any) {
    throw new Error('Não foi possível conectar ao servidor de processamento. Verifique sua conexão.');
  }

  if (!response.ok) {
    let errorDetail = 'Erro ao processar o cupom fiscal.';
    if (response.status === 404) {
      errorDetail = 'A rota /api/parse-receipt não foi encontrada (404). Se estiver na Vercel, certifique-se de que a variável GEMINI_API_KEY está configurada no painel da Vercel e o arquivo vercel.json foi implantado.';
    } else {
      try {
        const errJson = await response.json();
        errorDetail = errJson.error || errJson.message || errorDetail;
      } catch {
        errorDetail = `Erro no servidor (${response.status}): ${response.statusText}`;
      }
    }
    throw new Error(errorDetail);
  }

  const data = await response.json();
  return data as ParsedReceiptData;
};

// Parse plain text or copied content from SEFAZ portal / NFC-e websites
export const parseNfceTextContent = (textContent: string): ParsedReceiptData => {
  const lines = textContent.split('\n').map((l) => l.trim()).filter(Boolean);
  let supplier = 'Fornecedor / NFC-e';
  let cnpj: string | undefined;
  let totalAmount = 0;
  let accessKey: string | undefined;
  let date: string = new Date().toISOString().substring(0, 10);
  let nfcNumber: string | undefined;
  let series: string | undefined;
  let paymentMethod = 'Não informado';
  const items: ParsedReceiptData['items'] = [];

  // Check 44-digit access key
  const cleanAll = textContent.replace(/[\s.-]/g, '');
  const keyMatch = cleanAll.match(/\b\d{44}\b/) || textContent.match(/Chave\s*(?:de\s*Acesso)?:?\s*([\d\s.-]{44,60})/i);
  if (keyMatch) {
    accessKey = (keyMatch[1] || keyMatch[0]).replace(/[\s.-]/g, '');
    if (accessKey.length === 44) {
      const yearMonth = accessKey.substring(2, 6);
      date = `20${yearMonth.substring(0, 2)}-${yearMonth.substring(2, 4)}-01`;
      const rawCnpj = accessKey.substring(6, 20);
      cnpj = rawCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      series = accessKey.substring(22, 25);
      nfcNumber = accessKey.substring(25, 34).replace(/^0+/, '');
    }
  }

  // Find Supplier and CNPJ in text headers
  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const l = lines[i];
    const cnpjMatch = l.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (cnpjMatch) {
      cnpj = cnpjMatch[0];
      if (i > 0) {
        const candidate = lines[i - 1];
        if (
          !candidate.toLowerCase().includes('documento') &&
          !candidate.toLowerCase().includes('nfc-e') &&
          !candidate.toLowerCase().includes('secretaria')
        ) {
          supplier = candidate;
        }
      }
    }
    const dateMatch = l.match(/(?:Emiss[aã]o|Data):\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (dateMatch) {
      date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
  }

  // Parse SEFAZ items pattern:
  // ITEM NAME (Código: ...)
  // Qtde.: 1 UN: UN Vl. Unit.: 2,15 Vl. Total 2,15
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const itemDetailsMatch = line.match(
      /Qtde\.?:?\s*([\d.,]+)\s*UN:?\s*([A-Za-z0-9]+)\s*Vl\.\s*Unit\.?:?\s*([\d.,]+)\s*Vl\.\s*Total:?\s*([\d.,]+)/i
    );

    if (itemDetailsMatch) {
      const prevLine = i > 0 ? lines[i - 1] : 'Item';
      const codeMatch = prevLine.match(/\(C[oó]digo:\s*([^\)]+)\)/i);
      const rawName = prevLine.replace(/\(C[oó]digo:[^\)]+\)/i, '').trim() || 'Item sem descrição';
      const quantity = parseFloat(itemDetailsMatch[1].replace(',', '.')) || 1;
      const unit = itemDetailsMatch[2] || 'UN';
      const unitPrice = parseFloat(itemDetailsMatch[3].replace(',', '.')) || 0;
      const totalPrice = parseFloat(itemDetailsMatch[4].replace(',', '.')) || quantity * unitPrice;

      const category = guessCategory(rawName);
      const specs = guessPackageSpecs(rawName, unit, quantity, unitPrice, totalPrice);

      items.push({
        rawName,
        code: codeMatch ? codeMatch[1].trim() : '',
        quantity,
        unit,
        unitPrice: unitPrice > 0 ? unitPrice : (quantity > 0 ? totalPrice / quantity : totalPrice),
        totalPrice,
        category,
        suggestedPackageAmount: specs.amount,
        suggestedUnit: specs.unit
      });
    }

    // Secondary table format (Code Name Qty Unit Price Total)
    const genericTableMatch = line.match(/^([A-Za-z0-9\s/._-]+?)\s+([\d.,]+)\s+(KG|G|UN|UND|L|ML|CX|PCT|ROLO|M)\s+X?\s*([\d.,]+)\s+([\d.,]+)$/i);
    if (!itemDetailsMatch && genericTableMatch) {
      const rawName = genericTableMatch[1].trim();
      const quantity = parseFloat(genericTableMatch[2].replace(',', '.')) || 1;
      const unit = genericTableMatch[3];
      const unitPrice = parseFloat(genericTableMatch[4].replace(',', '.')) || 0;
      const totalPrice = parseFloat(genericTableMatch[5].replace(',', '.')) || quantity * unitPrice;

      const category = guessCategory(rawName);
      const specs = guessPackageSpecs(rawName, unit, quantity, unitPrice, totalPrice);

      items.push({
        rawName,
        quantity,
        unit,
        unitPrice: unitPrice > 0 ? unitPrice : (quantity > 0 ? totalPrice / quantity : totalPrice),
        totalPrice,
        category,
        suggestedPackageAmount: specs.amount,
        suggestedUnit: specs.unit
      });
    }

    // Check payment & total
    const totalMatch = line.match(/(?:Valor\s+a\s+pagar|Valor\s+Total|Total\s+R\$|TOTAL)\s*R?\$?:?\s*([\d.,]+)/i);
    if (totalMatch && !totalAmount) {
      totalAmount = parseFloat(totalMatch[1].replace(',', '.')) || 0;
    }
    const payMatch = line.match(/Forma\s+de\s+pagamento:?\s*([A-Za-zÀ-ÿ\s]+)/i);
    if (payMatch) {
      paymentMethod = payMatch[1].trim();
    }
  }

  if (totalAmount === 0 && items.length > 0) {
    totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  return {
    supplier,
    cnpj,
    date,
    accessKey,
    nfcNumber,
    series,
    totalAmount,
    paymentMethod,
    items
  };
};

// Automatic Fuzzy Matching to link with existing ingredients or packaging
export const findBestMatch = (
  rawName: string,
  category: 'ingredient' | 'packaging',
  ingredients: Ingredient[],
  packagingList: Packaging[]
): { id: string; name: string; score: number } | null => {
  const cleanRaw = rawName
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(kg|g|un|und|ml|l|pct|cx|lt)\b/g, '')
    .trim();

  const words = cleanRaw.split(/\s+/).filter(w => w.length >= 3);
  if (words.length === 0) return null;

  const targetList = category === 'ingredient' 
    ? ingredients.map(i => ({ id: i.id, name: i.name }))
    : packagingList.map(p => ({ id: p.id, name: p.name }));

  let bestMatch: { id: string; name: string; score: number } | null = null;

  for (const item of targetList) {
    const cleanTarget = item.name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .trim();

    let matchedWords = 0;
    for (const word of words) {
      if (cleanTarget.includes(word)) {
        matchedWords++;
      }
    }

    const score = words.length > 0 ? (matchedWords / words.length) : 0;
    if (score >= 0.4 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: item.id, name: item.name, score };
    }
  }

  return bestMatch;
};
