// Adiciona gtag à interface global Window para o TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

/**
 * Envia um evento customizado para o Google Analytics.
 * @param action - O nome do evento (ex: 'login', 'click_register_cta').
 * @param params - Um objeto com parâmetros adicionais para o evento.
 */
export const trackEvent = (action: string, params?: Record<string, any>) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', action, params);
  } else {
    // Fallback para ambiente de desenvolvimento ou se o GA não carregar
    console.log(`[Analytics Event]: ${action}`, params);
  }
};


export const formatCurrency = (value: number) => {
    if (value === null || !isFinite(value)) {
        return 'N/A';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const safeParseFloat = (value: string | number | undefined | null): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') {
        return isFinite(value) ? value : 0;
    }
    // Handle strings, which might have commas for decimals
    const num = parseFloat(String(value).replace(',', '.'));
    return isFinite(num) ? num : 0;
};
