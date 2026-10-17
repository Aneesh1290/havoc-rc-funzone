"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItem {
  id: string;
  type: string;
  date: string;
  timeSlot: string;
  quantity: number;
  price: number;
  ticketId: number;
  simulatorName?: string;
  simulatorSlot?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  cartTotal: number;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      // Check if item with same type, date, timeSlot and simulator details exists
      const existing = prev.find(i => 
        i.ticketId === item.ticketId && 
        i.date === item.date && 
        i.timeSlot === item.timeSlot &&
        i.simulatorName === item.simulatorName &&
        i.simulatorSlot === item.simulatorSlot
      );
      if (existing) {
        return prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, item];
    });
    setIsCartOpen(true); // Auto-open cart when adding
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const clearCart = () => setItems([]);

  const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, isCartOpen, setIsCartOpen, cartTotal, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
