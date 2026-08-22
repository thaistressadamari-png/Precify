import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('A chave de API GEMINI_API_KEY não foi encontrada nas variáveis de ambiente da Vercel.');
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
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'Nenhuma imagem ou documento foi enviado.' });
    }

    const ai = getGeminiClient();

    const prompt = `Você é um assistente especializado em digitalização e extração ultrarrápida de Cupons Fiscais (NFC-e, NF-e, SAT, CF-e, recibos) de supermercados, atacados e lojas do Brasil (ex: Alpha Centro Comercio, Cavicchiolli, Atacadão, Assaí, Carrefour, Pão de Açúcar, Dia, Shibata, etc.).
Analise a imagem da nota fiscal/cupom fiscal fornecida com extrema precisão e extraia todos os itens e metadados.

Regras de Extração:
1. Extraia o nome do estabelecimento/supermercado/loja (supplier).
2. Extraia o CNPJ, se visível.
3. Extraia a data da compra no formato "YYYY-MM-DD" (apenas ano-mês-dia).
4. Extraia a Chave de Acesso (CHAVE DE ACESSO com 44 dígitos numéricos, mesmo que esteja impressa com espaços em blocos de 4 dígitos como "3526 0807 2203..."). Retorne apenas os 44 dígitos numéricos sem espaços.
5. Extraia o Número do cupom (NFC-e ou Controle) e Série se houver.
6. Extraia o Valor Total pago (totalAmount em número float, ex: 4.95 ou 24.04).
7. Extraia a Forma de Pagamento (ex: "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Pix").
8. Extraia cada item da compra:
   - rawName: descrição exata do item (ex: "CRISTAL LIQUIDO BISNAGA 40G", "BANANA NANICA KG", "NATA FRIMESA 300G", "LEITE CONDENSADO MOÇA 395G").
   - code: código do produto ou código de barras se houver.
   - quantity: quantidade comprada em número float (ex: 1, 2, ou 0.895 para peso).
   - unit: unidade impressa na nota (ex: "Kg", "Un", "g", "L", "Cx", "Pct").
   - unitPrice: valor unitário impresso (ex: 4.95 ou 16.99).
   - totalPrice: valor total do item (ex: 4.95 ou 16.99).
   - category: 'ingredient' (se for alimento, fruta, laticínio, farinha, açúcar, fermento, chocolate, etc.) ou 'packaging' (se for embalagem, caixa, forma, fita, copo, saco, prato, etc.).
   - suggestedPackageAmount: tamanho da embalagem ou quantidade líquida em número (ex: para 40G coloque 40; para 300G coloque 300; para 395G coloque 395; para 1KG coloque 1000; para 1 Un coloque 1).
   - suggestedUnit: uma das unidades: 'g', 'kg', 'ml', 'l', 'un', 'pacote', 'rolo', 'm'.

Retorne ESTRITAMENTE o JSON de acordo com o esquema solicitado.`;

    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash'];
    let lastError: any = null;
    let responseText = '';

    for (const modelName of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 800));
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
            break;
          }
        } catch (err: any) {
          console.warn(`Tentativa com o modelo ${modelName} falhou:`, err?.message || err);
          lastError = err;
        }
      }
      if (responseText) {
        break;
      }
    }

    if (!responseText) {
      throw lastError || new Error('Não foi possível obter resposta dos modelos de IA.');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    return res.status(200).json(parsedData);
  } catch (err: any) {
    console.error('Erro no processamento da nota fiscal via Vercel Function:', err);
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
    return res.status(500).json({ error: message });
  }
}
