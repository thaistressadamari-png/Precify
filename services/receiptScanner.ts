import { GoogleGenAI } from '@google/genai';
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
export const guessPackageSpecs = (name: string, rawUnit: string, quantity: number, unitPrice: number, totalPrice: number): { amount: number; unit: Unit | PackagingUnit; price: number } => {
  const lower = name.toLowerCase();
  const normalizedRawUnit = (rawUnit || '').trim().toLowerCase();

  // Look for grams in title (e.g., 300g, 395g, 500g, 100g, 1kg, 5kg, 1l, 900ml)
  const gramMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gramas)\b/);
  const kgMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|quilos?)\b/);
  const mlMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(ml|mls)\b/);
  const lMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(l|lt|litros?)\b/);
  const unMatch = lower.match(/(\d+)\s*(un|und|unid|unidades|pecas?|peças?)\b/);

  if (normalizedRawUnit === 'kg') {
    // If unit is kg and quantity is e.g. 0.895 kg, we can store either as 1 kg at unit price or 0.895 kg
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

// Parse NFC-e QR Code String (e.g. from camera scanner)
export const parseNfceQrCode = (qrCodeString: string): Partial<ParsedReceiptData> => {
  const result: Partial<ParsedReceiptData> = {
    items: []
  };

  // Check for 44-digit access key inside URL or text
  const accessKeyMatch = qrCodeString.match(/\b\d{44}\b/) || qrCodeString.match(/p=(\d{44})/i) || qrCodeString.match(/chNFe=(\d{44})/i);
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

  result.supplier = "Cupom Fiscal NFC-e (Lido via QR Code)";
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

// Parse Receipt Photo / Document using Gemini Vision API
export const parseReceiptImageWithGemini = async (imageBase64: string, mimeType: string = 'image/jpeg'): Promise<ParsedReceiptData> => {
  const apiKey = process.env.GEMINI_API_KEY || (process.env as any).API_KEY || '';
  if (!apiKey) {
    throw new Error("Chave de API Gemini não configurada.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Você é um especialista em leitura e extração de dados de Cupons Fiscais (NFC-e, NF-e, SAT, CF-e) de supermercados, atacados e lojas do Brasil (exemplo: Cavicchiolli, Atacadão, Assaí, Carrefour, Pão de Açúcar, etc.).
Analise a imagem da nota fiscal/cupom fiscal fornecida com extrema precisão e extraia todos os itens e metadados no formato JSON.

Regras de Extração:
1. Extraia o nome do estabelecimento/supermercado (supplier).
2. Extraia o CNPJ, se visível.
3. Extraia a data da compra no formato "YYYY-MM-DD" (se tiver hora, use apenas a data).
4. Extraia a Chave de Acesso (44 dígitos numéricos) se estiver impressa ou próxima ao QR Code.
5. Extraia o Número do cupom (NFC-e ou Controle) e Série se houver.
6. Extraia o Valor Total pago (totalAmount em número float, ex: 24.04).
7. Extraia a Forma de Pagamento (ex: "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Pix").
8. Extraia cada item da compra:
   - rawName: descrição exata do item (ex: "BANANA NANICA KG", "NATA FRIMESA 300G", "LEITE CONDENSADO MOCA 395G").
   - code: código do produto ou código de barras se houver.
   - quantity: quantidade comprada como float (ex: 0.895 para kg, 1 para unidade, 3 para 3 pacotes).
   - unit: unidade que está impressa na nota (ex: "Kg", "Un", "g", "L", "Cx", "Pct").
   - unitPrice: valor unitário impresso (ex: 7.88 ou 16.99).
   - totalPrice: valor total do item (ex: 7.05 ou 16.99).
   - category: classifique se é 'ingredient' (alimento, fruta, laticínio, farinha, açúcar, fermento, chocolate, etc.) ou 'packaging' (embalagem, caixa, forma, fita, copo, saco, prato, etc.).
   - suggestedPackageAmount: tamanho da embalagem ou quantidade líquida em número (ex: para "NATA FRIMESA 300G" é 300; para "LEITE COND 395G" é 395; para 0.895 Kg é 0.895 ou 895; para 1 Un é 1).
   - suggestedUnit: 'g' | 'kg' | 'ml' | 'l' | 'un' | 'pacote' | 'rolo' | 'm'.

Retorne ESTRITAMENTE um objeto JSON válido no seguinte formato (sem formatações de markdown adicionais além do json):
{
  "supplier": "Supermercados Cavicchiolli Ltda",
  "cnpj": "43.259.548/0027-00",
  "date": "2026-08-14",
  "accessKey": "352608432595480027006521100012155711609434",
  "nfcNumber": "121557",
  "series": "211",
  "totalAmount": 24.04,
  "paymentMethod": "Cartão de Crédito",
  "items": [
    {
      "rawName": "BANANA NANICA KG",
      "code": "000000002117",
      "quantity": 0.895,
      "unit": "Kg",
      "unitPrice": 7.88,
      "totalPrice": 7.05,
      "category": "ingredient",
      "suggestedPackageAmount": 0.895,
      "suggestedUnit": "kg"
    },
    {
      "rawName": "NATA FRIMESA 300G",
      "code": "7896275970185",
      "quantity": 1,
      "unit": "Un",
      "unitPrice": 16.99,
      "totalPrice": 16.99,
      "category": "ingredient",
      "suggestedPackageAmount": 300,
      "suggestedUnit": "g"
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType
            }
          }
        ]
      }
    ],
    config: {
      responseMimeType: 'application/json'
    }
  });

  const responseText = response.text || '{}';
  try {
    const parsed = JSON.parse(responseText);
    return parsed as ParsedReceiptData;
  } catch (err) {
    // If JSON wrapped in ```json block
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as ParsedReceiptData;
  }
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
