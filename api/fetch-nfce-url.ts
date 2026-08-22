import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('A chave de API GEMINI_API_KEY não foi encontrada nas variáveis de ambiente.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { url } = req.body;
    console.log('🔍 [SEFAZ API] Nova requisição de consulta recebida.');
    console.log('🔗 [SEFAZ API] URL recebida:', url);

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      console.warn('⚠️ [SEFAZ API] URL inválida rejeitada:', url);
      return res.status(400).json({ error: 'URL do cupom fiscal inválida.' });
    }

    console.log('🌐 [SEFAZ API] Fazendo requisição HTTP para o portal da SEFAZ...');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow'
    });

    console.log(`📡 [SEFAZ API] Resposta da SEFAZ: Status ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`Falha ao acessar o portal da SEFAZ (Status HTTP ${response.status} - ${response.statusText}).`);
    }

    const html = await response.text();
    console.log(`📄 [SEFAZ API] Conteúdo HTML obtido com sucesso! Tamanho: ${html.length} caracteres.`);

    function guessCategory(name: string): string {
      const lower = name.toLowerCase();
      const packagingKeywords = [
        'caixa', 'fita', 'sacola', 'embalagem', 'pote', 'copo', 'prato', 'kraft',
        'cetim', 'tampa', 'bobina', 'papel', 'fitilho', 'saco', 'etiqueta', 'forma'
      ];
      if (packagingKeywords.some((k) => lower.includes(k))) return 'packaging';
      return 'ingredient';
    }

    function guessPackageSpecs(rawName: string, unit: string, quantity: number, unitPrice: number, totalPrice: number) {
      const lower = rawName.toLowerCase();
      const gMatch = lower.match(/(\d+[\d.,]*)\s*(?:g|gr|gramas)\b/);
      if (gMatch) return { amount: parseFloat(gMatch[1].replace(',', '.')), unit: 'g' };
      const kgMatch = lower.match(/(\d+[\d.,]*)\s*(?:kg|quilos)\b/);
      if (kgMatch) return { amount: parseFloat(kgMatch[1].replace(',', '.')) * 1000, unit: 'g' };
      const mlMatch = lower.match(/(\d+[\d.,]*)\s*(?:ml|mls)\b/);
      if (mlMatch) return { amount: parseFloat(mlMatch[1].replace(',', '.')), unit: 'ml' };
      const lMatch = lower.match(/(\d+[\d.,]*)\s*(?:l|litros?)\b/);
      if (lMatch) return { amount: parseFloat(lMatch[1].replace(',', '.')) * 1000, unit: 'ml' };
      const mMatch = lower.match(/(\d+[\d.,]*)\s*(?:m|metros)\b/);
      if (mMatch) return { amount: parseFloat(mMatch[1].replace(',', '.')), unit: 'm' };
      const undMatch = lower.match(/(\d+[\d.,]*)\s*(?:und|un|unid)\b/);
      if (undMatch) return { amount: parseFloat(undMatch[1].replace(',', '.')), unit: 'un' };
      return { amount: 1, unit: unit.toLowerCase() === 'kg' ? 'kg' : 'un' };
    }

    // Fast RegEx parser for standard SEFAZ NFC-e QR Code page
    let supplier = 'Fornecedor / NFC-e';
    const topoMatch =
      html.match(/<div[^>]*class="txtTopo"[^>]*>([^<]+)<\/div>/i) ||
      html.match(/<div class="txtTopo">([^<]+)<\/div>/i) ||
      html.match(/<div class="txtTit">([^<]+)<\/div>/i);
    if (topoMatch) {
      supplier = topoMatch[1].trim();
    }

    let cnpj = '';
    const cnpjMatch = html.match(/CNPJ:\s*([\d.\/-]+)/i);
    if (cnpjMatch) {
      cnpj = cnpjMatch[1].trim();
    }

    let date = new Date().toISOString().substring(0, 10);
    const dateMatch =
      html.match(/Emiss[aã]o:\s*<\/strong>\s*(\d{2})\/(\d{2})\/(\d{4})/i) ||
      html.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dateMatch) {
      date = `${dateMatch[3] || dateMatch[1]}-${dateMatch[2]}-${dateMatch[1] || dateMatch[3]}`;
    }

    let accessKey = '';
    const keyMatch =
      html.match(/<span class="chave">([^<]+)<\/span>/i) ||
      url.match(/[?&]p=([0-9]{44})/i) ||
      url.match(/p=([0-9]{44})/i);
    if (keyMatch) {
      accessKey = (keyMatch[1] || keyMatch[0]).replace(/[\s.-]/g, '');
    }

    let nfcNumber = '';
    let series = '';
    const numMatch = html.match(/<strong>N[uú]mero:\s*<\/strong>\s*(\d+)/i);
    if (numMatch) nfcNumber = numMatch[1];
    const serMatch = html.match(/<strong>\s*S[eé]rie:\s*<\/strong>\s*(\d+)/i);
    if (serMatch) series = serMatch[1];

    let totalAmount = 0;
    const totalMatch =
      html.match(/<label>Valor a pagar R\$:<\/label>\s*<span class="totalNumb txtMax">([^<]+)<\/span>/i) ||
      html.match(/<span class="totalNumb txtMax">([^<]+)<\/span>/i) ||
      html.match(/(?:Valor\s+a\s+pagar|Valor\s+Total)\s*R?\$?:?\s*([\d.,]+)/i);
    if (totalMatch) {
      totalAmount = parseFloat(totalMatch[1].replace(',', '.'));
    }

    const items: any[] = [];
    const rowRegex = /<tr id="Item \+ \d+">([\s\S]*?)<\/tr>/gi;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];

      const nameMatch = rowHtml.match(/<span class="txtTit">([^<]+)<\/span>/i);
      const rawName = nameMatch ? nameMatch[1].trim() : 'Item sem nome';

      const codeMatch = rowHtml.match(/<span class="RCod">[\s\S]*?\(C[oó]digo:\s*([^\)]+)\)[\s\S]*?<\/span>/i);
      const code = codeMatch ? codeMatch[1].trim() : '';

      const qtdMatch = rowHtml.match(/<span class="Rqtd"><strong>Qtde\.:<\/strong>\s*([\d.,]+)<\/span>/i);
      const quantity = qtdMatch ? parseFloat(qtdMatch[1].replace(',', '.')) : 1;

      const unMatch = rowHtml.match(/<span class="RUN"><strong>UN:\s*<\/strong>\s*([^<]+)<\/span>/i);
      const unit = unMatch ? unMatch[1].trim() : 'UN';

      const vlUnitMatch = rowHtml.match(/<span class="RvlUnit"><strong>Vl\.\s*Unit\.:<\/strong>[\s\S]*?([0-9.,]+)<\/span>/i);
      const unitPrice = vlUnitMatch ? parseFloat(vlUnitMatch[1].replace(',', '.')) : 0;

      const vlTotMatch = rowHtml.match(/<span class="valor">([^<]+)<\/span>/i);
      const totalPrice = vlTotMatch ? parseFloat(vlTotMatch[1].replace(',', '.')) : quantity * unitPrice;

      const category = guessCategory(rawName);
      const specs = guessPackageSpecs(rawName, unit, quantity, unitPrice, totalPrice);

      items.push({
        rawName,
        code,
        quantity,
        unit,
        unitPrice: unitPrice > 0 ? unitPrice : quantity > 0 ? totalPrice / quantity : totalPrice,
        totalPrice,
        category,
        suggestedPackageAmount: specs.amount,
        suggestedUnit: specs.unit
      });
    }

    if (items.length > 0) {
      console.log(`✅ [SEFAZ API] Sucesso! ${items.length} itens extraídos via parser HTML.`);
      console.log(`🏢 [SEFAZ API] Fornecedor: ${supplier} | CNPJ: ${cnpj} | Total: R$ ${totalAmount}`);
      items.forEach((it, idx) => {
        console.log(`   [${idx + 1}] ${it.quantity}x ${it.rawName} - Unit: R$ ${it.unitPrice} | Total: R$ ${it.totalPrice}`);
      });

      return res.json({
        supplier,
        cnpj,
        date,
        accessKey,
        nfcNumber,
        series,
        totalAmount: totalAmount || items.reduce((s, i) => s + i.totalPrice, 0),
        paymentMethod: 'Cartão / Dinheiro',
        items
      });
    }

    console.log('🤖 [SEFAZ API] Parser HTML padrão não localizou a tabela direta de itens. Acionando Gemini AI Fallback...');
    // If regex didn't find items (different state portal layout), fallback to Gemini AI with HTML text
    const cleanText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 15000);

    const ai = getGeminiClient();
    const prompt = `Analise o texto extraído da consulta pública da NFC-e da SEFAZ e retorne os dados fiscais e a lista de itens adquiridos com extrema precisão em JSON:
Texto da página:
${cleanText}`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplier: { type: Type.STRING },
            cnpj: { type: Type.STRING },
            date: { type: Type.STRING },
            accessKey: { type: Type.STRING },
            nfcNumber: { type: Type.STRING },
            series: { type: Type.STRING },
            totalAmount: { type: Type.NUMBER },
            paymentMethod: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rawName: { type: Type.STRING },
                  code: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  unitPrice: { type: Type.NUMBER },
                  totalPrice: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  suggestedPackageAmount: { type: Type.NUMBER },
                  suggestedUnit: { type: Type.STRING }
                },
                required: ['rawName', 'quantity', 'unitPrice', 'totalPrice']
              }
            }
          },
          required: ['supplier', 'totalAmount', 'items']
        }
      }
    });

    if (aiResponse.text) {
      const parsedJson = JSON.parse(aiResponse.text);
      console.log(`✅ [SEFAZ API] Sucesso via Gemini AI! ${parsedJson.items?.length || 0} itens extraídos.`);
      return res.json(parsedJson);
    }

    throw new Error('Não foi possível extrair a lista de itens do link da SEFAZ.');
  } catch (err: any) {
    console.error('❌ [SEFAZ API] Erro ao consultar URL da SEFAZ:', err);
    return res.status(500).json({ error: err.message || 'Falha ao buscar dados na SEFAZ.' });
  }
}
