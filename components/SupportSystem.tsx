
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, orderBy, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { SupportTicket, User, TicketCategory, SupportMessage } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { formatCurrency } from './utils';

interface SupportSystemProps {
  user: User;
}

export const SupportSystem: React.FC<SupportSystemProps> = ({ user }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  
  const [newTicketData, setNewTicketData] = useState({
    subject: '',
    category: 'question' as TicketCategory,
    description: ''
  });

  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    // Query simplified to avoid requiring a composite index for userId + updatedAt
    const q = query(
      collection(db, "support_tickets"),
      where("userId", "==", user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
      
      // Manual sorting to avoid Firestore Index requirement
      ticketsList.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis() || 0;
        const timeB = b.updatedAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setTickets(ticketsList);
      setLoading(false);
      
      // Update selected ticket if it's currently open
      if (selectedTicket) {
        const updated = ticketsList.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    });

    return () => unsubscribe();
  }, [user.id, selectedTicket?.id]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketData.subject || !newTicketData.description) return;

    const firstMessage: SupportMessage = {
      id: Date.now().toString(),
      senderId: user.id,
      senderName: user.name,
      senderRole: 'user',
      text: newTicketData.description,
      timestamp: Timestamp.now()
    };

    const ticket: Omit<SupportTicket, 'id'> = {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      subject: newTicketData.subject,
      category: newTicketData.category,
      status: 'open',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      messages: [firstMessage]
    };

    try {
      await addDoc(collection(db, "support_tickets"), ticket);
      setShowNewTicketForm(false);
      setNewTicketData({ subject: '', category: 'question', description: '' });
    } catch (err) {
      console.error("Error creating ticket:", err);
      alert("Erro ao criar chamado.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;

    const msg: SupportMessage = {
      id: Date.now().toString(),
      senderId: user.id,
      senderName: user.name,
      senderRole: 'user',
      text: newMessage,
      timestamp: Timestamp.now()
    };

    try {
      const ticketRef = doc(db, "support_tickets", selectedTicket.id);
      await updateDoc(ticketRef, {
        messages: arrayUnion(msg),
        updatedAt: Timestamp.now(),
        status: 'open' // Back to open if user replies
      });
      setNewMessage('');
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
      closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    const labels = { open: 'Aberto', in_progress: 'Em Atendimento', closed: 'Resolvido' };
    return <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status as keyof typeof styles]}`}>{labels[status as keyof typeof labels]}</span>;
  };

  const categories = { bug: 'Bug', improvement: 'Melhoria', question: 'Dúvida', other: 'Outro' };

  if (loading) return <div className="text-center py-10 text-brand-text dark:text-gray-200">Carregando seus chamados...</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="font-display text-4xl text-brand-text dark:text-rose-100">Ajuda e Suporte</h1>
        <button 
          onClick={() => { setShowNewTicketForm(true); setSelectedTicket(null); }}
          className="flex items-center gap-2 bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105"
        >
          <PlusIcon className="w-5 h-5"/> Novo Chamado
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tickets List */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 h-full">
          <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Meus Chamados</h2>
          {tickets.length === 0 ? (
            <p className="text-center text-brand-light-text dark:text-gray-400 italic py-10">Você ainda não criou nenhum chamado.</p>
          ) : (
            <ul className="space-y-3">
              {tickets.map(t => (
                <li 
                  key={t.id} 
                  onClick={() => { setSelectedTicket(t); setShowNewTicketForm(false); }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedTicket?.id === t.id ? 'bg-rose-100 border-brand-primary dark:bg-rose-900/30' : 'bg-rose-50 border-rose-100 dark:bg-gray-700/50 dark:border-gray-600 hover:bg-rose-100 dark:hover:bg-gray-700'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-brand-text dark:text-gray-200 truncate pr-2">{t.subject}</p>
                    {getStatusBadge(t.status)}
                  </div>
                  <div className="flex justify-between text-xs text-brand-light-text dark:text-gray-400">
                    <span>{categories[t.category]}</span>
                    <span>{t.updatedAt?.toDate()?.toLocaleDateString('pt-BR')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail/Form Column */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700 min-h-[500px] flex flex-col">
          {showNewTicketForm ? (
            <form onSubmit={handleCreateTicket} className="space-y-4 animate-fade-in-up">
              <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">Novo Chamado</h2>
              <div>
                <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Assunto</label>
                <input 
                  type="text" 
                  value={newTicketData.subject} 
                  onChange={e => setNewTicketData({...newTicketData, subject: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md"
                  placeholder="Ex: Erro ao salvar receita"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Categoria</label>
                <select 
                  value={newTicketData.category} 
                  onChange={e => setNewTicketData({...newTicketData, category: e.target.value as TicketCategory})}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md"
                >
                  <option value="question">Dúvida</option>
                  <option value="bug">Bug / Erro</option>
                  <option value="improvement">Sugestão / Melhoria</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400">Descrição detalhada</label>
                <textarea 
                  value={newTicketData.description} 
                  onChange={e => setNewTicketData({...newTicketData, description: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md h-32"
                  placeholder="Conte-nos o que está acontecendo..."
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowNewTicketForm(false)} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-bold">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-brand-primary text-white rounded-lg font-bold">Enviar Chamado</button>
              </div>
            </form>
          ) : selectedTicket ? (
            <div className="flex flex-col h-full animate-fade-in">
              <div className="border-b border-rose-100 dark:border-gray-700 pb-4 mb-4 flex justify-between items-center">
                <div>
                  <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">{selectedTicket.subject}</h2>
                  <p className="text-xs text-brand-light-text dark:text-gray-400">Protocolo: {selectedTicket.id}</p>
                </div>
                {getStatusBadge(selectedTicket.status)}
              </div>

              <div className="flex-grow overflow-y-auto space-y-4 mb-4 pr-2">
                {selectedTicket.messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.senderRole === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl ${msg.senderRole === 'user' ? 'bg-brand-primary text-white rounded-tr-none' : 'bg-rose-100 dark:bg-gray-700 text-brand-text dark:text-gray-200 rounded-tl-none'}`}>
                      {msg.senderRole === 'admin' && <p className="text-[10px] font-bold uppercase mb-1 opacity-70">Equipe Precify</p>}
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    <span className="text-[10px] text-brand-light-text dark:text-gray-400 mt-1">
                      {msg.timestamp?.toDate()?.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>

              {selectedTicket.status !== 'closed' ? (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input 
                    type="text" 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-grow px-4 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-xl"
                  />
                  <button type="submit" className="px-6 py-2 bg-brand-primary text-white rounded-xl font-bold hover:bg-rose-700 transition-colors">Enviar</button>
                </form>
              ) : (
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl text-brand-light-text dark:text-gray-400 italic text-sm">
                  Este chamado foi encerrado. Se precisar de mais ajuda, crie um novo chamado.
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <div className="p-6 bg-rose-50 dark:bg-gray-700/50 rounded-full mb-4">
                <PlusIcon className="w-12 h-12 text-brand-primary" />
              </div>
              <h3 className="font-display text-xl text-brand-text dark:text-rose-100">Selecione um chamado ao lado</h3>
              <p className="text-brand-light-text dark:text-gray-400 max-w-xs mt-2">Veja o histórico de conversas ou crie um novo pedido de suporte.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
