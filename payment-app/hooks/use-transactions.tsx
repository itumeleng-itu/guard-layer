import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Transaction {
  id: string;
  type: 'sent' | 'received' | 'blocked';
  recipient: string;
  amount: number;
  currency: string;
  date: Date;
  status: 'success' | 'blocked';
  reason?: string;
}

interface TransactionContextType {
  balance: number;
  transactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, 'id' | 'date'>) => void;
}

const TransactionContext = createContext<TransactionContextType>({
  balance: 12450,
  transactions: [],
  addTransaction: () => {},
});

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState(12450);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const addTransaction = useCallback((tx: Omit<Transaction, 'id' | 'date'>) => {
    const newTx: Transaction = {
      ...tx,
      id: `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: new Date(),
    };

    setTransactions(prev => [newTx, ...prev]);

    // Update balance
    if (tx.type === 'sent' && tx.status === 'success') {
      setBalance(prev => prev - tx.amount);
    } else if (tx.type === 'received') {
      setBalance(prev => prev + tx.amount);
    }
    // Blocked transactions don't affect balance
  }, []);

  return (
    <TransactionContext.Provider value={{ balance, transactions, addTransaction }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  return useContext(TransactionContext);
}
