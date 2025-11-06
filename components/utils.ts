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