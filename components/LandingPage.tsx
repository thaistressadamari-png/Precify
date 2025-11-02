import React, { useState } from 'react';
import { CalculatorIcon } from './icons/CalculatorIcon';
import { ClipboardListIcon } from './icons/ClipboardListIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';

interface LandingPageProps {
  onNavigateToRegister: () => void;
  onNavigateToLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToRegister, onNavigateToLogin }) => {
  const [expandedImageSrc, setExpandedImageSrc] = useState<string | null>(null);

  const FeatureCard: React.FC<{ icon: React.ElementType, title: string, children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <div className="bg-white/50 dark:bg-gray-800/50 p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 backdrop-blur-sm text-center transform hover:-translate-y-2 transition-transform duration-300">
      <div className="inline-block p-4 bg-brand-primary text-white rounded-full mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="font-display text-xl text-brand-text dark:text-rose-100 mb-2">{title}</h3>
      <p className="text-brand-light-text dark:text-gray-400 text-sm leading-relaxed">{children}</p>
    </div>
  );

  return (
    <div className="bg-brand-background dark:bg-gray-900 min-h-screen font-sans text-brand-text dark:text-gray-200">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="font-display text-3xl font-bold text-brand-primary">Precify</h1>
          <button
            onClick={onNavigateToLogin}
            className="inline-block bg-transparent hover:bg-rose-100 dark:hover:bg-gray-800 text-brand-primary dark:text-rose-200 font-bold py-2 px-6 rounded-lg border-2 border-brand-primary transition-colors"
          >
            Acessar
          </button>
        </div>
      </header>
      
      {/* Hero Section */}
      <main className="relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-rose-50 to-orange-100 dark:from-gray-900 dark:to-rose-900/30 opacity-50 transform -skew-y-6 scale-150"></div>
        <section className="container mx-auto px-6 pt-32 pb-16 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="text-center md:text-left animate-fade-in-down">
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-brand-text dark:text-white leading-tight mb-4">
                Simplifique sua precificação. <span className="text-brand-primary">Aumente seu lucro.</span>
              </h2>
              <p className="text-lg text-brand-light-text dark:text-gray-300 mb-6" style={{ animationDelay: '0.2s' }}>
                O Precify é a ferramenta completa de gestão e precificação feita especialmente para confeiteiros e pequenos negócios de alimentação. Controle seus custos, calcule preços de venda com precisão e descubra a lucratividade real de cada receita — tudo em um só lugar.
              </p>
              <button
                onClick={onNavigateToRegister}
                className="bg-brand-primary hover:bg-rose-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 text-lg" style={{ animationDelay: '0.4s' }}
              >
                👉 Começar agora gratuitamente
              </button>
              <p className="mt-4 text-brand-text dark:text-gray-300 font-semibold" style={{ animationDelay: '0.6s' }}>
                Controle total, resultados reais.
              </p>
            </div>
            <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <img 
                src="https://i.imgur.com/qTiDJ6w.png" 
                alt="Dashboard do Precify mostrando gráficos e receitas" 
                className="rounded-2xl shadow-2xl border-4 border-white dark:border-gray-700 cursor-pointer transition-transform transform hover:scale-105" 
                onClick={() => setExpandedImageSrc("https://i.imgur.com/qTiDJ6w.png")}
              />
            </div>
          </div>
        </section>

        {/* Pain Point Section */}
        <section className="py-20 bg-white dark:bg-gray-900/70 relative">
          <div className="container mx-auto px-6 animate-fade-in-up">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              {/* Image Column */}
              <div className="flex justify-center items-center">
                <div className="relative p-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-secondary to-brand-accent rounded-full blur-3xl opacity-20 dark:opacity-10"></div>
                    <img 
                        src="https://i.imgur.com/EPdfQhG.png" 
                        alt="Confeiteira preocupada com as finanças" 
                        className="relative shadow-2xl w-full max-w-sm h-auto object-cover"
                        style={{
                            borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%'
                        }}
                    />
                </div>
              </div>

              {/* Text Column */}
              <div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-text dark:text-white leading-tight mb-4">
                💰 Você sabe quanto realmente lucra em cada receita?
                </h2>
                <p className="text-lg text-brand-light-text dark:text-gray-300 mb-6">
                A maioria dos confeiteiros vende sem saber o custo real do que produz. Os preços dos ingredientes mudam, o gás e a energia aumentam — e quando você percebe, o lucro desapareceu.
                </p>
                <p className="text-lg text-brand-text dark:text-gray-200 bg-rose-50 dark:bg-gray-800 p-4 rounded-lg border-l-4 border-brand-primary shadow-sm">
                O Precify foi criado para resolver isso: ele calcula tudo por você, mostra onde está seu lucro (ou prejuízo) e ajuda a definir preços certos, de forma simples e profissional.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="py-20 bg-rose-50/50 dark:bg-gray-800/20 relative">
          <div className="container mx-auto px-6 text-center animate-fade-in-up">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-text dark:text-white leading-tight mb-4">
              Chega de "chutar" o preço e perder dinheiro.
            </h2>
            <p className="text-lg text-brand-light-text dark:text-gray-300 max-w-2xl mx-auto">
              Veja a diferença que o cálculo certo faz no seu bolso.
            </p>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
              {/* Card 1: Achismo */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-rose-200 dark:border-gray-700">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl">❌</span>
                  <h3 className="font-display text-2xl text-brand-text dark:text-rose-100">Preço no "Achismo"</h3>
                </div>
                <p className="text-brand-light-text dark:text-gray-400 mb-4">
                  Você multiplica o custo dos ingredientes por 3, mas esquece do gás, da energia, do seu tempo, das embalagens e das taxas do cartão.
                </p>
                <div className="mt-6 pt-4 border-t border-rose-200 dark:border-gray-600">
                  <p className="text-sm text-brand-light-text dark:text-gray-400">Resultado:</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-500">PREJUÍZO ou lucro zero</p>
                </div>
              </div>
              {/* Card 2: Precify */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border-2 border-brand-primary">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl">✅</span>
                  <h3 className="font-display text-2xl text-brand-text dark:text-rose-100">Preço com Precify</h3>
                </div>
                <p className="text-brand-light-text dark:text-gray-400 mb-4">
                  Todos os custos são calculados com precisão: ingredientes, mão de obra, custos fixos e variáveis, impostos e a sua margem de lucro desejada.
                </p>
                <div className="mt-6 pt-4 border-t border-rose-200 dark:border-gray-600">
                  <p className="text-sm text-brand-light-text dark:text-gray-400">Resultado:</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-500">LUCRO REAL e garantido</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-brand-background dark:bg-gray-900">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12 animate-fade-in-up">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-text dark:text-white mb-4">
                Tudo que você precisa em um só lugar
              </h2>
              <p className="text-lg text-brand-light-text dark:text-gray-300 max-w-2xl mx-auto">
                Deixe as planilhas complicadas para trás. O Precify tem tudo que você precisa para gerenciar sua produção de forma inteligente.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard icon={CalculatorIcon} title="Precificação Automática">
                Cadastre seus ingredientes uma vez e o sistema calcula o custo exato de cada receita, incluindo mão de obra, energia e gás.
              </FeatureCard>
              <FeatureCard icon={ClipboardListIcon} title="Controle de Ingredientes">
                Mantenha um registro de todos os seus ingredientes, custos de compra e fornecedores. Saiba quando um preço está desatualizado.
              </FeatureCard>
              <FeatureCard icon={ChartBarIcon} title="Análise de Lucratividade">
                Visualize de forma clara o custo, o preço de venda e o lucro de cada produto. Tome decisões baseadas em dados reais.
              </FeatureCard>
               <FeatureCard icon={DocumentArrowDownIcon} title="Ficha Técnica Profissional">
                Gere fichas técnicas em PDF com um clique, com ingredientes, modo de preparo e suas observações, prontas para imprimir.
              </FeatureCard>
            </div>
          </div>
        </section>

        {/* Price Breakdown Section */}
        <section className="py-20 bg-white dark:bg-gray-900/70 relative">
          <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-up">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-text dark:text-white leading-tight mb-4">
                Demonstrativo de Preço: Transparência total.
              </h2>
              <p className="text-lg text-brand-light-text dark:text-gray-300 mb-4">
                Entenda exatamente como o preço final do seu produto é formado. O Precify detalha cada etapa do cálculo, desde o custo dos ingredientes e da sua mão de obra, passando pelas taxas, até chegar no seu lucro.
              </p>
              <ul className="space-y-2 text-brand-text dark:text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✔</span> Custo de ingredientes e embalagens.
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✔</span> Custo da sua hora de trabalho.
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✔</span> Custos fixos (energia, gás).
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✔</span> Taxas (cartão, delivery) e impostos.
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✔</span> Sua margem de lucro desejada.
                </li>
              </ul>
            </div>
             <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
               <img 
                 src="https://i.imgur.com/EXT1zOI.png" 
                 alt="Demonstrativo de preço do Precify" 
                 className="rounded-2xl shadow-2xl border-4 border-white dark:border-gray-700 cursor-pointer transition-transform transform hover:scale-105"
                 onClick={() => setExpandedImageSrc("https://i.imgur.com/EXT1zOI.png")}
               />
             </div>
          </div>
        </section>
        
        {/* PDF Feature Section */}
        <section className="py-20 bg-rose-50/50 dark:bg-gray-800/20 relative">
          <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
             <div className="animate-fade-in-up order-2 md:order-1" style={{ animationDelay: '0.2s' }}>
                <img 
                    src="https://i.imgur.com/3e3t3Ik.png" 
                    alt="Ficha técnica em PDF gerada pelo Precify" 
                    className="rounded-2xl shadow-2xl border-4 border-white dark:border-gray-700 cursor-pointer transition-transform transform hover:scale-105"
                    onClick={() => setExpandedImageSrc("https://i.imgur.com/3e3t3Ik.png")}
                />
             </div>
             <div className="animate-fade-in-up order-1 md:order-2">
                <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-text dark:text-white leading-tight mb-4">
                  Gere Fichas Técnicas em PDF com um clique.
                </h2>
                <p className="text-lg text-brand-light-text dark:text-gray-300">
                  Uma das funções mais poderosas do Precify. Com um clique, o sistema gera um arquivo PDF profissional com o nome da receita, lista de ingredientes e modo de preparo, ideal para organizar a produção, treinar sua equipe ou manter um padrão de qualidade impecável.
                </p>
             </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 bg-white dark:bg-gray-900/70">
          <div className="container mx-auto px-6 text-center animate-fade-in-up">
            <h2 className="font-display text-3xl font-bold text-brand-text dark:text-white mb-10">
              ⭐ O que dizem nossos confeiteiros
            </h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-rose-50 dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-left">
                <p className="text-brand-text dark:text-gray-200 text-lg italic mb-4">“Antes do Precify eu chutava os preços. Hoje eu sei exatamente quanto lucro em cada doce. É libertador!”</p>
                <p className="font-semibold text-brand-primary">— Maria Clara, confeiteira artesanal</p>
              </div>
              <div className="bg-rose-50 dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 text-left">
                <p className="text-brand-text dark:text-gray-200 text-lg italic mb-4">“Economizei horas com planilhas. O sistema calcula tudo sozinho e a ficha técnica em PDF é incrível para organizar a cozinha.”</p>
                <p className="font-semibold text-brand-primary">— Lucas, dono da Doce Luar Confeitaria</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 bg-rose-50/50 dark:bg-gray-900/70">
          <div className="container mx-auto px-6 text-center animate-fade-in-up">
            <h2 className="font-display text-4xl font-bold text-brand-text dark:text-white mb-4">🚀 Comece hoje mesmo</h2>
            <p className="text-lg text-brand-light-text dark:text-gray-300 mb-6 max-w-2xl mx-auto">
              Descubra como é simples ter controle total sobre seus custos e lucros. Cadastre-se agora e teste o Precify gratuitamente.
            </p>
            <button
              onClick={onNavigateToRegister}
              className="bg-brand-primary hover:bg-rose-700 text-white font-bold py-4 px-10 rounded-lg shadow-2xl transition-transform transform hover:scale-105 text-xl"
            >
              👉 Experimentar agora – é grátis
            </button>
          </div>
        </section>

      </main>
      
      {/* Footer */}
      <footer className="bg-rose-100/50 dark:bg-gray-800/50">
          <div className="container mx-auto px-6 py-6 text-center text-brand-light-text dark:text-gray-400">
              <p>&copy; {new Date().getFullYear()} Precify. Todos os direitos reservados.</p>
          </div>
      </footer>
      
      {/* Image Modal */}
      {expandedImageSrc && (
          <div 
              className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
              onClick={() => setExpandedImageSrc(null)}
          >
              <button
                  onClick={() => setExpandedImageSrc(null)}
                  className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10 bg-black/30 rounded-full p-2"
                  aria-label="Fechar imagem"
              >
                  <XMarkIcon className="w-8 h-8" />
              </button>
              <img 
                  src={expandedImageSrc} 
                  alt="Visualização expandida" 
                  className="max-w-full max-h-full rounded-lg shadow-2xl border-4 border-white/10"
                  onClick={(e) => e.stopPropagation()}
              />
          </div>
      )}
    </div>
  );
};