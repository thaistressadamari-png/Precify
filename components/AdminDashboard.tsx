
import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, updateDoc, Timestamp, addDoc, query, orderBy, limit, where, writeBatch, onSnapshot, arrayUnion, setDoc } from 'firebase/firestore';
import type { User, ActionHistory, SupportTicket, TicketStatus, SupportMessage, GlobalConfig } from '../types';
import { ArrowRightOnRectangleIcon } from './icons/ArrowRightOnRectangleIcon';
import { SearchIcon } from './icons/SearchIcon';
import { AdjustmentsHorizontalIcon } from './icons/AdjustmentsHorizontalIcon';
import { ArrowUturnLeftIcon } from './icons/ArrowUturnLeftIcon';
import { QuestionMarkCircleIcon } from './icons/QuestionMarkCircleIcon';
import { Cog6ToothIcon } from './icons/Cog6ToothIcon';
import { BulkActionModal } from './BulkActionModal';

// --- GLOBAL CONFIG COMPONENT ---
const GlobalConfigPanel: React.FC<{ config: GlobalConfig; adminUser: User }> = ({ config, adminUser }) => {
    const [localConfig, setLocalConfig] = useState<GlobalConfig>(config);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await setDoc(doc(db, "app_config", "global"), localConfig);
            
            await addDoc(collection(db, 'action_history'), {
                timestamp: Timestamp.now(),
                actionType: 'GLOBAL_CONFIG_CHANGE',
                description: `Admin '${adminUser.name}' alterou as configurações globais (Trial: ${localConfig.trialDays}d, Link: ${localConfig.paymentLink}).`,
                adminId: adminUser.id,
                adminName: adminUser.name,
                userId: adminUser.id,
                userName: adminUser.name,
                details: { old: config, new: localConfig }
            });
            alert("Configurações salvas com sucesso!");
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar configurações.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="space-y-6 max-w-xl animate-fade-in">
            <div>
                <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400 mb-1">Link de Pagamento (Checkout Kiwify/Outro)</label>
                <input 
                    type="url" 
                    value={localConfig.paymentLink}
                    onChange={e => setLocalConfig({...localConfig, paymentLink: e.target.value})}
                    placeholder="https://pay.kiwify.com.br/..."
                    className="block w-full px-4 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-lg shadow-sm focus:ring-brand-secondary focus:border-brand-secondary"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-brand-light-text dark:text-gray-400 mb-1">Duração do Teste Gratuito (Dias)</label>
                <input 
                    type="number" 
                    value={localConfig.trialDays}
                    onChange={e => setLocalConfig({...localConfig, trialDays: parseInt(e.target.value) || 0})}
                    className="block w-full px-4 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-lg shadow-sm focus:ring-brand-secondary focus:border-brand-secondary"
                    min="0"
                    required
                />
                <p className="text-xs text-brand-light-text dark:text-gray-500 mt-1">Este valor será aplicado a todos os NOVOS cadastros realizados a partir de agora.</p>
            </div>
            <button 
                type="submit" 
                disabled={loading}
                className="bg-brand-primary hover:bg-rose-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:bg-rose-300"
            >
                {loading ? 'Salvando...' : 'Salvar Configurações'}
            </button>
        </form>
    );
};

// --- TICKET RESPONSE COMPONENT ---
const AdminTicketView: React.FC<{ ticket: SupportTicket; adminUser: User; onClose: () => void }> = ({ ticket, adminUser, onClose }) => {
    const [response, setResponse] = useState('');
    const [status, setStatus] = useState<TicketStatus>(ticket.status);

    const handleSendResponse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!response.trim()) return;

        const msg: SupportMessage = {
            id: Date.now().toString(),
            senderId: adminUser.id,
            senderName: adminUser.name,
            senderRole: 'admin',
            text: response,
            timestamp: Timestamp.now()
        };

        try {
            const ticketRef = doc(db, "support_tickets", ticket.id);
            await updateDoc(ticketRef, {
                messages: arrayUnion(msg),
                status: 'in_progress',
                updatedAt: Timestamp.now()
            });
            setResponse('');
            
            // Log Admin Action
            await addDoc(collection(db, 'action_history'), {
                timestamp: Timestamp.now(),
                actionType: 'TICKET_RESPONSE',
                description: `Admin '${adminUser.name}' respondeu ao chamado '${ticket.subject}' de '${ticket.userName}'.`,
                adminId: adminUser.id,
                adminName: adminUser.name,
                userId: ticket.userId,
                userName: ticket.userName,
            });
        } catch (err) {
            console.error("Error sending admin response:", err);
        }
    };

    const handleUpdateStatus = async (newStatus: TicketStatus) => {
        try {
            const ticketRef = doc(db, "support_tickets", ticket.id);
            await updateDoc(ticketRef, { status: newStatus, updatedAt: Timestamp.now() });
            setStatus(newStatus);
        } catch (err) { console.error(err); }
    };

    return (
        <div className="flex flex-col h-[600px] animate-fade-in">
            <div className="flex justify-between items-start border-b border-rose-100 dark:border-gray-700 pb-4 mb-4">
                <div>
                    <h3 className="font-display text-2xl text-brand-text dark:text-rose-100">{ticket.subject}</h3>
                    <p className="text-sm text-brand-light-text dark:text-gray-400">Usuário: {ticket.userName} ({ticket.userEmail})</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <select 
                        value={status} 
                        onChange={(e) => handleUpdateStatus(e.target.value as TicketStatus)}
                        className="text-xs border rounded p-1 bg-white dark:bg-gray-700"
                    >
                        <option value="open">Aberto</option>
                        <option value="in_progress">Em Atendimento</option>
                        <option value="closed">Resolvido / Fechado</option>
                    </select>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto space-y-4 mb-4 pr-2">
                {ticket.messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.senderRole === 'admin' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl ${msg.senderRole === 'admin' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-rose-100 dark:bg-gray-700 text-brand-text dark:text-gray-200 rounded-tl-none'}`}>
                            <p className="text-[10px] font-bold uppercase mb-1 opacity-70">{msg.senderRole === 'admin' ? 'Você (Admin)' : msg.senderName}</p>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        </div>
                        <span className="text-[10px] text-brand-light-text dark:text-gray-400 mt-1">
                            {msg.timestamp.toDate().toLocaleString('pt-BR')}
                        </span>
                    </div>
                ))}
            </div>

            <form onSubmit={handleSendResponse} className="flex gap-2">
                <textarea 
                    value={response} 
                    onChange={e => setResponse(e.target.value)}
                    placeholder="Digite sua resposta oficial..."
                    className="flex-grow px-4 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-xl resize-none h-20"
                />
                <button type="submit" className="px-6 bg-brand-primary text-white rounded-xl font-bold hover:bg-rose-700 transition-colors">Responder</button>
            </form>
        </div>
    );
};

const UserActionHistoryLog: React.FC<{ userId: string }> = ({ userId }) => {
    const [actions, setActions] = useState<ActionHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchActions = async () => {
            if (!userId) return;
            setLoading(true);
            setError('');
            try {
                const actionsQuery = query(
                    collection(db, "action_history"),
                    where("userId", "==", userId),
                    limit(50)
                );
                const querySnapshot = await getDocs(actionsQuery);
                const actionsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActionHistory));
                actionsList.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
                setActions(actionsList);
            } catch (err) {
                console.error("Error fetching user action history:", err);
                setError('Falha ao carregar o histórico do usuário.');
            } finally {
                setLoading(false);
            }
        };
        fetchActions();
    }, [userId]);

    if (loading) return <p className="text-center py-4 text-sm text-gray-500">Carregando histórico...</p>;
    if (error) return <p className="text-center py-4 text-sm text-red-500">{error}</p>;
    if (actions.length === 0) return <p className="text-center py-4 text-sm text-gray-500">Nenhuma ação registrada para este usuário.</p>;

    return (
        <div className="max-h-64 overflow-y-auto pr-2 space-y-3 rounded-lg bg-rose-50/50 dark:bg-gray-900/50 p-3 border border-rose-200 dark:border-gray-700">
            {actions.map(action => (
                <div key={action.id} className="p-3 bg-white dark:bg-gray-700/50 rounded-md shadow-sm">
                    <p className="text-brand-text dark:text-gray-200 text-sm">{action.description}</p>
                    <p className="text-xs text-brand-light-text dark:text-gray-400 mt-1">
                        {action.timestamp.toDate().toLocaleString('pt-BR')}
                    </p>
                </div>
            ))}
        </div>
    );
};


const UserEditModal: React.FC<{
    user: User;
    onClose: () => void;
    onSave: (userId: string, data: { isSubscribed: boolean, trialEndsAt: Timestamp, role: 'admin' | 'user' }, originalUser: User) => void;
}> = ({ user, onClose, onSave }) => {
    const [isSubscribed, setIsSubscribed] = useState(user.isSubscribed || false);
    const [role, setRole] = useState(user.role || 'user');
    const [trialDate, setTrialDate] = useState(() => {
        if (user.trialEndsAt) {
            return user.trialEndsAt.toDate().toISOString().split('T')[0];
        }
        return '';
    });

    const handleSave = () => {
        let trialTimestamp;
        try {
            if (!trialDate) {
                 throw new Error("Data inválida.");
            }
            const dateWithTime = new Date(trialDate);
            dateWithTime.setMinutes(dateWithTime.getMinutes() + dateWithTime.getTimezoneOffset());
            trialTimestamp = Timestamp.fromDate(dateWithTime);
        } catch (e) {
            alert('Data inválida.');
            return;
        }
        onSave(user.id, { isSubscribed, trialEndsAt: trialTimestamp, role }, user);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl">
                <div className="p-6 max-h-[90vh] overflow-y-auto">
                    <h2 className="font-display text-2xl text-brand-text dark:text-rose-100 mb-4">Gerenciar Usuário</h2>
                    <div className="space-y-4 text-sm mb-6">
                        <p><strong className="text-brand-light-text dark:text-gray-400 font-medium">Nome:</strong> <span className="text-brand-text dark:text-gray-200">{user.name}</span></p>
                        <p><strong className="text-brand-light-text dark:text-gray-400 font-medium">Email:</strong> <span className="text-brand-text dark:text-gray-200">{user.email}</span></p>
                        <p><strong className="text-brand-light-text dark:text-gray-400 font-medium">Telefone:</strong> <span className="text-brand-text dark:text-gray-200">{user.phone || 'Não informado'}</span></p>
                    </div>
                    <div className="space-y-4 p-4 bg-rose-50 dark:bg-gray-800/50 rounded-lg border border-rose-100 dark:border-gray-700">
                        <div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={isSubscribed} onChange={(e) => setIsSubscribed(e.target.checked)} className="h-5 w-5 rounded text-brand-primary focus:ring-brand-secondary border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-offset-gray-800"/>
                                <span className="font-medium text-brand-text dark:text-gray-200">Assinatura Ativa</span>
                            </label>
                        </div>
                        <div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={role === 'admin'} onChange={(e) => setRole(e.target.checked ? 'admin' : 'user')} className="h-5 w-5 rounded text-brand-primary focus:ring-brand-secondary border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-offset-gray-800"/>
                                <span className="font-medium text-brand-text dark:text-gray-200">Tornar Administrador</span>
                            </label>
                        </div>
                        <div>
                            <label htmlFor="trialDate" className="block text-sm font-medium text-brand-light-text dark:text-gray-400 mb-1">Data de Fim do Teste</label>
                            <input
                                type="date"
                                id="trialDate"
                                value={trialDate}
                                onChange={(e) => setTrialDate(e.target.value)}
                                className="block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-rose-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
                            />
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-rose-200 dark:border-gray-700">
                        <h3 className="font-display text-xl text-brand-text dark:text-rose-100 mb-4">Histórico de Ações do Usuário</h3>
                        <UserActionHistoryLog userId={user.id} />
                    </div>

                    <div className="flex justify-end gap-4 mt-8">
                        <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-4 rounded-lg">
                            Cancelar
                        </button>
                        <button onClick={handleSave} className="bg-brand-primary hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg">
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


export const AdminDashboard: React.FC<{ onLogout: () => void; currentUser: User; onGoToApp: () => void; globalConfig: GlobalConfig }> = ({ onLogout, currentUser, onGoToApp, globalConfig }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'support' | 'config'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [filter, setFilter] = useState<'all' | 'trial' | 'subscribed' | 'expired' | 'open' | 'closed'>('all');
    
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [bulkAction, setBulkAction] = useState<'extend' | 'subscribe' | null>(null);
    const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        const usersUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        });

        const ticketsUnsubscribe = onSnapshot(query(collection(db, "support_tickets"), orderBy("updatedAt", "desc")), (snapshot) => {
            setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket)));
            setLoading(false);
        });

        return () => {
            usersUnsubscribe();
            ticketsUnsubscribe();
        };
    }, []);

    const handleUpdateUser = async (userId: string, data: { isSubscribed: boolean, trialEndsAt: Timestamp, role: 'admin' | 'user' }, originalUser: User) => {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, data);
            
            const changes = [];
            if (originalUser.isSubscribed !== data.isSubscribed) {
                changes.push(`status de assinatura para '${data.isSubscribed ? 'Ativo' : 'Inativo'}'`);
            }
            const originalDate = originalUser.trialEndsAt?.toDate().toISOString().split('T')[0];
            const newDate = data.trialEndsAt.toDate().toISOString().split('T')[0];
            if (originalDate !== newDate) {
                changes.push(`data final do teste para '${newDate}'`);
            }
            if ((originalUser.role || 'user') !== data.role) {
                changes.push(`permissão para '${data.role === 'admin' ? 'Admin' : 'Usuário'}'`);
            }

            if(changes.length > 0) {
                 await addDoc(collection(db, 'action_history'), {
                    timestamp: Timestamp.now(),
                    actionType: 'ADMIN_STATUS_CHANGE',
                    description: `Admin '${currentUser.name}' alterou ${changes.join(' e ')} para o usuário '${originalUser.name}'.`,
                    adminId: currentUser.id,
                    adminName: currentUser.name,
                    userId: originalUser.id,
                    userName: originalUser.name,
                    details: { from: { isSubscribed: originalUser.isSubscribed, trialEndsAt: originalDate, role: originalUser.role || 'user' }, to: data },
                });
            }
            setEditingUser(null);
        } catch (err) {
            console.error(err);
            alert('Falha ao atualizar usuário.');
        }
    };
    
    const getUserStatus = (user: User): { text: string; color: string } => {
        if (user.isSubscribed) {
            return { text: 'Ativo', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' };
        }
        if (user.trialEndsAt) {
            if (user.trialEndsAt.toDate() > new Date()) {
                const daysLeft = Math.ceil((user.trialEndsAt.toDate().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return { text: `Em Teste (${daysLeft}d)`, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' };
            }
            return { text: 'Expirado', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' };
        }
        return { text: 'Pendente', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
    };

    const filteredUsers = useMemo(() => {
        const now = new Date();
        return users
            .filter(user => {
                const trialEnds = user.trialEndsAt?.toDate();
                const hasTrialEnded = trialEnds && trialEnds <= now;

                switch (filter) {
                    case 'subscribed': return user.isSubscribed;
                    case 'trial': return !user.isSubscribed && trialEnds && !hasTrialEnded;
                    case 'expired': return !user.isSubscribed && hasTrialEnded;
                    default: return true;
                }
            })
            .filter(user =>
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [users, searchTerm, filter]);

    const filteredTickets = useMemo(() => {
        return tickets.filter(t => {
            if (filter === 'open') return t.status === 'open' || t.status === 'in_progress';
            if (filter === 'closed') return t.status === 'closed';
            return true;
        }).filter(t => 
            t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [tickets, searchTerm, filter]);
    
    const handleSelectUser = (userId: string) => {
        setSelectedUserIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) { newSet.delete(userId); } else { newSet.add(userId); }
            return newSet;
        });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allFilteredIds = new Set(filteredUsers.map(u => u.id));
            setSelectedUserIds(allFilteredIds);
        } else {
            setSelectedUserIds(new Set());
        }
    };
    
    const handleBulkUpdate = async (action: 'extend' | 'subscribe', days?: number) => {
        setBulkUpdateLoading(true);
        const batch = writeBatch(db);
        const usersToUpdate = users.filter(u => selectedUserIds.has(u.id));

        for (const user of usersToUpdate) {
            const userRef = doc(db, 'users', user.id);
            let updatedData: Partial<User> = {};
            let description = '';

            if (action === 'extend' && days) {
                const currentTrialEnd = user.trialEndsAt ? user.trialEndsAt.toDate() : new Date();
                const newTrialEnd = new Date(currentTrialEnd.getTime());
                newTrialEnd.setDate(newTrialEnd.getDate() + days);
                updatedData = { trialEndsAt: Timestamp.fromDate(newTrialEnd) };
                description = `Admin '${currentUser.name}' estendeu o teste em ${days} dias para ${user.name}.`;
            } else if (action === 'subscribe') {
                updatedData = { isSubscribed: true };
                description = `Admin '${currentUser.name}' marcou ${user.name} como assinante.`;
            }

            batch.update(userRef, updatedData);
            const historyRef = doc(collection(db, 'action_history'));
            batch.set(historyRef, {
                timestamp: Timestamp.now(),
                actionType: 'ADMIN_STATUS_CHANGE',
                description,
                adminId: currentUser.id,
                adminName: currentUser.name,
                userId: user.id,
                userName: user.name,
            });
        }

        try {
            await batch.commit();
            alert(`${usersToUpdate.length} usuários atualizados com sucesso!`);
        } catch (e) {
            console.error(e);
            alert("Erro ao atualizar usuários.");
        } finally {
            setBulkUpdateLoading(false);
            setSelectedUserIds(new Set());
            setBulkAction(null);
        }
    };

    return (
        <div className="bg-rose-50 dark:bg-gray-900 min-h-screen text-brand-text dark:text-gray-200 font-sans">
            <div className="container mx-auto px-4 py-8">
                <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
                    <h1 className="font-display text-3xl font-bold text-brand-primary">Gerenciamento</h1>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { setActiveTab('users'); setFilter('all'); setSearchTerm(''); }} className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'users' ? 'bg-brand-primary text-white' : 'text-brand-light-text dark:text-gray-400 hover:bg-rose-100'}`}>Usuários</button>
                        <button onClick={() => { setActiveTab('support'); setFilter('open'); setSearchTerm(''); }} className={`px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'support' ? 'bg-brand-primary text-white' : 'text-brand-light-text dark:text-gray-400 hover:bg-rose-100'}`}>Suporte</button>
                        <button onClick={() => { setActiveTab('config'); setSearchTerm(''); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors ${activeTab === 'config' ? 'bg-brand-primary text-white' : 'text-brand-light-text dark:text-gray-400 hover:bg-rose-100'}`}><Cog6ToothIcon className="w-5 h-5" /> Config</button>
                        <div className="mx-4 h-6 border-l border-rose-200"></div>
                        <button onClick={onGoToApp} className="flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors text-brand-light-text hover:bg-rose-100"><ArrowUturnLeftIcon className="w-5 h-5"/> App</button>
                        <button onClick={onLogout} className="flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors text-brand-light-text hover:bg-rose-100"><ArrowRightOnRectangleIcon className="w-5 h-5"/> Sair</button>
                    </div>
                </header>

                <main className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-rose-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                        <h2 className="font-display text-2xl text-brand-text dark:text-rose-100">
                            {activeTab === 'users' ? 'Gestão de Usuários' : activeTab === 'support' ? 'Chamados de Suporte' : 'Configurações Globais'}
                        </h2>
                        {activeTab !== 'config' && (
                            <div className="relative">
                                <input type="search" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 w-full sm:w-64 border border-rose-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200" />
                                <SearchIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                            </div>
                        )}
                    </div>

                    {activeTab !== 'config' && (
                        <div className="flex justify-start flex-wrap gap-2 mb-6 border-b border-rose-100 pb-4">
                            {activeTab === 'users' ? (
                                <>
                                    <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-full text-sm ${filter === 'all' ? 'bg-brand-primary text-white' : 'bg-rose-100 text-brand-light-text'}`}>Todos</button>
                                    <button onClick={() => setFilter('trial')} className={`px-3 py-1 rounded-full text-sm ${filter === 'trial' ? 'bg-brand-primary text-white' : 'bg-rose-100 text-brand-light-text'}`}>Em Teste</button>
                                    <button onClick={() => setFilter('subscribed')} className={`px-3 py-1 rounded-full text-sm ${filter === 'subscribed' ? 'bg-brand-primary text-white' : 'bg-rose-100 text-brand-light-text'}`}>Pagos</button>
                                    <button onClick={() => setFilter('expired')} className={`px-3 py-1 rounded-full text-sm ${filter === 'expired' ? 'bg-brand-primary text-white' : 'bg-rose-100 text-brand-light-text'}`}>Expirados</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-full text-sm ${filter === 'all' ? 'bg-brand-primary text-white' : 'bg-rose-100 text-brand-light-text'}`}>Todos</button>
                                    <button onClick={() => setFilter('open')} className={`px-3 py-1 rounded-full text-sm ${filter === 'open' ? 'bg-brand-primary text-white' : 'bg-rose-100 text-brand-light-text'}`}>Abertos/Em andamento</button>
                                    <button onClick={() => setFilter('closed')} className={`px-3 py-1 rounded-full text-sm ${filter === 'closed' ? 'bg-brand-primary text-white' : 'bg-rose-100 text-brand-light-text'}`}>Resolvidos</button>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'users' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-rose-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="p-3 w-4"><input type="checkbox" onChange={handleSelectAll} checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length} /></th>
                                        <th className="p-3 text-sm font-semibold">Nome</th>
                                        <th className="p-3 text-sm font-semibold hidden md:table-cell">Email</th>
                                        <th className="p-3 text-sm font-semibold">Status</th>
                                        <th className="p-3 text-sm font-semibold text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-rose-100 dark:divide-gray-700">
                                    {filteredUsers.map(user => {
                                        const status = getUserStatus(user);
                                        return (
                                            <tr key={user.id} className={selectedUserIds.has(user.id) ? 'bg-rose-100 dark:bg-gray-700' : 'hover:bg-rose-50'}>
                                                <td className="p-3"><input type="checkbox" checked={selectedUserIds.has(user.id)} onChange={() => handleSelectUser(user.id)} /></td>
                                                <td className="p-3 font-medium">{user.name}</td>
                                                <td className="p-3 text-sm hidden md:table-cell">{user.email}</td>
                                                <td className="p-3"><span className={`px-2 py-1 text-xs font-bold rounded-full ${status.color}`}>{status.text}</span></td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => setEditingUser(user)} className="text-blue-500 hover:bg-blue-100 p-2 rounded-full"><AdjustmentsHorizontalIcon className="w-5 h-5"/></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {selectedUserIds.size > 0 && (
                                <div className="mt-4 p-4 bg-rose-50 rounded-xl flex justify-between items-center animate-fade-in-up">
                                    <span className="font-bold">{selectedUserIds.size} selecionados</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setBulkAction('extend')} className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold">Prorrogar</button>
                                        <button onClick={() => setBulkAction('subscribe')} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">Marcar Pago</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'support' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="max-h-[600px] overflow-y-auto space-y-3">
                                {filteredTickets.length === 0 ? <p className="text-center py-10 opacity-50 italic">Nenhum chamado encontrado.</p> : filteredTickets.map(t => (
                                    <div key={t.id} onClick={() => setSelectedTicket(t)} className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedTicket?.id === t.id ? 'bg-rose-100 border-brand-primary' : 'bg-rose-50 border-rose-100 hover:bg-rose-100'}`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="font-bold truncate text-sm">{t.subject}</p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${t.status === 'open' ? 'bg-green-500 text-white' : t.status === 'in_progress' ? 'bg-blue-500 text-white' : 'bg-gray-400 text-white'}`}>{t.status}</span>
                                        </div>
                                        <p className="text-xs text-brand-light-text mb-2">{t.userName}</p>
                                        <p className="text-[10px] opacity-50">{t.updatedAt.toDate().toLocaleString('pt-BR')}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="lg:col-span-2 border rounded-2xl p-6 bg-rose-50/30">
                                {selectedTicket ? <AdminTicketView ticket={selectedTicket} adminUser={currentUser} onClose={() => setSelectedTicket(null)} /> : (
                                    <div className="flex flex-col items-center justify-center h-full opacity-50 text-center">
                                        <QuestionMarkCircleIcon className="w-16 h-16 mb-2" />
                                        <p>Selecione um chamado para visualizar e responder.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <GlobalConfigPanel config={globalConfig} adminUser={currentUser} />
                    )}
                </main>
            </div>

            {editingUser && <UserEditModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleUpdateUser} />}
            {bulkAction && <BulkActionModal isOpen={!!bulkAction} action={bulkAction} selectedCount={selectedUserIds.size} onClose={() => setBulkAction(null)} onConfirm={handleBulkUpdate} loading={bulkUpdateLoading} />}
        </div>
    );
};
