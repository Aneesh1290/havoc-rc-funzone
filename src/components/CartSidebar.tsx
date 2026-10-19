"use client";

import React from 'react';
import { useCart } from '@/context/CartContext';
import { X, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SimPerkBadgeList } from './SimPerkBadgeList';

export function CartSidebar() {
  const { items, isCartOpen, setIsCartOpen, removeItem, cartTotal } = useCart();

  if (!isCartOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />
      
      {/* Sidebar */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transform animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#ff5a1f]/10 flex items-center justify-center text-[#ff5a1f]">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black font-heading text-gray-900">Your Cart</h2>
          </div>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-gray-400">
              <ShoppingCart className="w-16 h-16 opacity-20" />
              <p className="font-medium text-lg text-gray-500">Your cart is empty</p>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="text-[#ff5a1f] font-bold hover:underline"
              >
                Continue Browsing
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl border border-gray-100 bg-white flex gap-4 shadow-sm relative group">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{item.type.replace(/_/g, ' ')}</h3>
                    <p className="text-sm text-gray-500 mt-1">{item.date} • {item.timeSlot}</p>
                    <SimPerkBadgeList 
                      simNameStr={item.simulatorName} 
                      simSlotStr={item.simulatorSlot} 
                    />
                    <div className="flex justify-between items-end mt-3">
                      <p className="font-bold text-[#ff5a1f]">₹{item.price * item.quantity}</p>
                      <p className="text-sm font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 bg-gray-50 border-t border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-600 font-medium">Total Amount</span>
              <span className="text-2xl font-black text-gray-900">₹{cartTotal}</span>
            </div>
            <Link 
              href="/checkout"
              onClick={() => setIsCartOpen(false)}
              className="w-full bg-[#0d1b2a] hover:bg-[#ff5a1f] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[#ff5a1f]/20 group"
            >
              Proceed to Checkout
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
