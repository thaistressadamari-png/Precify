import React, { useState } from 'react';
import type { UserAuth } from '../types';

interface RegistrationPageProps {
  onRegister: (user: UserAuth) => void;
  onNavigateToLogin: () => void;
}

const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .slice(0, 14);
};

const formatPhone = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
};


export const RegistrationPage: React.FC<RegistrationPageProps> = ({ onRegister, onNavigateToLogin }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    cpf: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'cpf') {
      formattedValue = formatCPF(value);
    } else if (name === 'phone') {
      formattedValue = formatPhone(value);
    }
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (formData.password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
    }

    const newUser: UserAuth = {
        id: new Date().toISOString(),
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
    };
    
    onRegister(newUser);
  };

  const inputClasses = "mt-1 block w-full px-3 py-3 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary";

  return (
    <div className="bg-rose-50 dark:bg-gray-900 min-h-screen flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
            <h1 className="font-display text-6xl font-bold text-brand-primary">Precify</h1>
            <p className="text-brand-light-text dark:text-gray-400 mt-2">Sua confeitaria sob controle.</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-brand-text dark:text-rose-100 mb-2 text-center">Crie sua Conta</h2>
          <p className="text-center text-brand-light-text dark:text-gray-400 mb-6">É rápido e fácil.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="Nome Completo" required className={inputClasses} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Telefone de Contato" required className={inputClasses} />
              <input type="text" name="cpf" value={formData.cpf} onChange={handleInputChange} placeholder="CPF" required className={inputClasses} />
            </div>
            <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="E-mail" required autoComplete="email" className={inputClasses} />
            <input type="password" name="password" value={formData.password} onChange={handleInputChange} placeholder="Senha" required autoComplete="new-password" className={inputClasses} />
            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} placeholder="Confirmar Senha" required autoComplete="new-password" className={inputClasses} />
            
            {error && <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-brand-primary hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 transition-transform transform hover:scale-105"
              >
                Criar Conta
              </button>
            </div>
          </form>
           <div className="text-center mt-6">
              <p className="text-sm text-brand-light-text dark:text-gray-400">
                Já tem uma conta?{' '}
                <button onClick={onNavigateToLogin} className="font-semibold text-brand-primary hover:text-rose-700 dark:text-brand-secondary dark:hover:text-pink-400 focus:outline-none focus:underline">
                  Faça login
                </button>
              </p>
            </div>
        </div>
      </div>
    </div>
  );
};
