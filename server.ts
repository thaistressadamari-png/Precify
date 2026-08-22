import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

// Lazy load Gemini AI instance
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('A chave de API GEMINI_API_KEY não foi encontrada nas variáveis de ambiente do servidor.');
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY)
    });
  });

  // Fetch and parse NFC-e URL from SEFAZ
  app.post('/api/fetch-nfce-url', async (req, res) => {
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
  });

  // Parse Receipt Image with Gemini API with resilient model fallback
  app.post('/api/parse-receipt', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'Nenhuma imagem ou documento foi enviado.' });
      }

      const ai = getGeminiClient();

      const prompt = `Você é um assistente especializado em digitalização e extração ultrarrápida de Cupons Fiscais (NFC-e, NF-e, SAT, CF-e, recibos, fotos de comprovantes e capturas de tela/prints de consulta pública da SEFAZ) do Brasil.
Analise o documento fiscal/screenshot/imagem fornecida com extrema precisão e extraia todos os itens e metadados.

Regras de Extração:
1. Extraia o nome do estabelecimento/supermercado/loja (supplier).
2. Extraia o CNPJ, se visível.
3. Extraia a data da compra no formato "YYYY-MM-DD" (apenas ano-mês-dia).
4. Extraia a Chave de Acesso (CHAVE DE ACESSO com 44 dígitos numéricos, mesmo que esteja impressa com espaços em blocos de 4 dígitos como "3526 0807 2203..."). Retorne apenas os 44 dígitos numéricos sem espaços.
5. Extraia o Número do cupom (NFC-e ou Controle) e Série se houver.
6. Extraia o Valor Total pago (totalAmount em número float, ex: 18.86 ou 4.95).
7. Extraia a Forma de Pagamento (ex: "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Pix").
8. Extraia cada item da compra:
   - rawName: descrição exata do item (ex: "CAIXA 1 CUPCAKE C TAMPA 1UND C5038 IDEIA", "FITA CETIM NAJAR COR 25 10MX22MM", "SACOLA KRAFT P CROMUS", "LEITE CONDENSADO MOÇA 395G").
   - code: código do produto, código de barras ou EAN se houver (ex: 7908015136574).
   - quantity: quantidade comprada em número float (ex: 1, 2, ou 0.895 para peso).
   - unit: unidade impressa na nota (ex: "UN", "Kg", "g", "L", "Cx", "Pct").
   - unitPrice: valor unitário impresso (ex: 2.15 ou 7.29).
   - totalPrice: valor total do item (ex: 2.15 ou 4.78).
   - category: 'ingredient' (se for alimento, fruta, laticínio, farinha, açúcar, fermento, chocolate, etc.) ou 'packaging' (se for embalagem, caixa, fita de cetim, sacola kraft, forma, fita, copo, saco, prato, etc.).
   - suggestedPackageAmount: tamanho da embalagem ou quantidade líquida em número (ex: para 40G coloque 40; para 10MX22MM coloque 10; para 1UND coloque 1; para 395G coloque 395; para 1KG coloque 1000).
   - suggestedUnit: uma das unidades: 'g', 'kg', 'ml', 'l', 'un', 'pacote', 'rolo', 'm'.

Retorne ESTRITAMENTE o JSON de acordo com o esquema solicitado.`;

      const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash'];
      let lastError: any = null;
      let responseText = '';

      for (const modelName of candidateModels) {
        // Try up to 2 times per model in case of temporary 503
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            if (attempt > 0) {
              await new Promise(resolve => setTimeout(resolve, 800));
            }
            const response = await ai.models.generateContent({
              model: modelName,
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
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    supplier: { type: Type.STRING, description: 'Nome do fornecedor / supermercado' },
                    cnpj: { type: Type.STRING, description: 'CNPJ do estabelecimento' },
                    date: { type: Type.STRING, description: 'Data da compra no formato YYYY-MM-DD' },
                    accessKey: { type: Type.STRING, description: 'Chave de acesso de 44 dígitos' },
                    nfcNumber: { type: Type.STRING, description: 'Número do cupom fiscal' },
                    series: { type: Type.STRING, description: 'Série do cupom' },
                    totalAmount: { type: Type.NUMBER, description: 'Valor total do cupom' },
                    paymentMethod: { type: Type.STRING, description: 'Forma de pagamento utilizada' },
                    items: {
                      type: Type.ARRAY,
                      description: 'Lista de itens adquiridos',
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          rawName: { type: Type.STRING, description: 'Nome original do item' },
                          code: { type: Type.STRING, description: 'Código do item ou EAN' },
                          quantity: { type: Type.NUMBER, description: 'Quantidade comprada' },
                          unit: { type: Type.STRING, description: 'Unidade impressa na nota' },
                          unitPrice: { type: Type.NUMBER, description: 'Preço unitário' },
                          totalPrice: { type: Type.NUMBER, description: 'Preço total do item' },
                          category: { type: Type.STRING, description: 'ingredient ou packaging' },
                          suggestedPackageAmount: { type: Type.NUMBER, description: 'Quantidade líquida do pacote' },
                          suggestedUnit: { type: Type.STRING, description: 'Unidade padrão g, kg, ml, l, un, pacote, rolo, m' }
                        },
                        required: ['rawName', 'quantity', 'unitPrice', 'totalPrice']
                      }
                    }
                  },
                  required: ['supplier', 'totalAmount', 'items']
                }
              }
            });

            if (response.text) {
              responseText = response.text;
              break; // Success!
            }
          } catch (err: any) {
            console.warn(`Tentativa com o modelo ${modelName} (tentativa ${attempt + 1}) falhou:`, err?.message || err);
            lastError = err;
          }
        }
        if (responseText) {
          break;
        }
      }

      if (!responseText) {
        throw lastError || new Error('Não foi possível obter resposta de nenhum dos modelos de IA.');
      }

      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch (e) {
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedData = JSON.parse(cleaned);
      }

      return res.json(parsedData);
    } catch (err: any) {
      console.error('Erro no processamento da nota fiscal via Gemini:', err);
      let message = 'Falha ao processar o cupom fiscal.';
      if (err?.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.error?.message) {
            message = parsed.error.message;
          } else {
            message = err.message;
          }
        } catch {
          message = err.message;
        }
      }
      return res.status(500).json({
        error: message
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Erro fatal ao iniciar servidor:', err);
  process.exit(1);
});
