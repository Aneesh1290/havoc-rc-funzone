"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ShoppingCart, ArrowRight, Menu, X } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { items, setIsCartOpen } = useCart();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link 
          href="/" 
          className="flex items-center shrink-0 mr-4" 
          onClick={(e) => {
            if (e.detail === 3) {
              e.preventDefault();
              router.push('/admin');
            } else {
              setIsMobileMenuOpen(false);
            }
          }}
        >
          <img src="/logo.png" alt="Havoc RC Funzone Logo" className="h-[64px] sm:h-[80px] md:h-[96px] w-auto max-w-[75vw] sm:max-w-none object-contain" />
        </Link>
        
        <nav className="hidden lg:flex items-center gap-10 font-sans text-[17px] font-bold text-gray-700">
          <Link href="/" className="hover:text-[#ff5a1f] transition-colors pb-1">Home</Link>
          <Link href="/ticket-type" className="hover:text-[#ff5a1f] transition-colors pb-1">Ticket Type</Link>
          <Link href="/tickets" className="hover:text-[#ff5a1f] transition-colors pb-1">Book Slots</Link>
          <Link href="/gallery" className="hover:text-[#ff5a1f] transition-colors pb-1">Gallery</Link>
          <Link href="/about" className="hover:text-[#ff5a1f] transition-colors pb-1">About</Link>
          <Link href="/contact" className="hover:text-[#ff5a1f] transition-colors pb-1">Contact</Link>
        </nav>

        <div className="flex items-center gap-6">
          <button 
            type="button"
            onClick={() => setIsCartOpen(true)}
            aria-label="Open Cart"
            className="relative p-2 text-gray-700 hover:text-[#ff5a1f] transition-colors"
          >
            <ShoppingCart className="w-7 h-7" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#ff5a1f] text-white text-xs font-black rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center border-2 border-white shadow-sm animate-in zoom-in-50 duration-200">
                {totalItems}
              </span>
            )}
          </button>
          <Link href="/tickets" className="hidden md:flex bg-[#ff5a1f] hover:bg-[#e04812] text-white px-8 py-3.5 rounded-full font-sans text-[16px] font-bold transition-colors items-center gap-2 shadow-md shadow-[#ff5a1f]/20">
            Book Now <ArrowRight className="w-5 h-5" />
          </Link>
          <button className="lg:hidden p-2 text-gray-700" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-20 left-0 w-full bg-white border-b border-gray-200 shadow-lg py-4 px-4 flex flex-col gap-4 font-sans font-semibold text-gray-700">
          <Link href="/" className="block py-2 hover:text-[#ff5a1f]" onClick={toggleMobileMenu}>Home</Link>
          <Link href="/ticket-type" className="block py-2 hover:text-[#ff5a1f]" onClick={toggleMobileMenu}>Ticket Type</Link>
          <Link href="/tickets" className="block py-2 hover:text-[#ff5a1f]" onClick={toggleMobileMenu}>Book Slots</Link>
          <button 
            type="button" 
            className="flex items-center justify-between py-2 text-left hover:text-[#ff5a1f]" 
            onClick={() => {
              toggleMobileMenu();
              setIsCartOpen(true);
            }}
          >
            <span>Cart</span>
            {totalItems > 0 && (
              <span className="bg-[#ff5a1f] text-white text-xs font-black rounded-full px-2 py-0.5">
                {totalItems}
              </span>
            )}
          </button>
          <Link href="/gallery" className="block py-2 hover:text-[#ff5a1f]" onClick={toggleMobileMenu}>Gallery</Link>
          <Link href="/about" className="block py-2 hover:text-[#ff5a1f]" onClick={toggleMobileMenu}>About</Link>
          <Link href="/contact" className="block py-2 hover:text-[#ff5a1f]" onClick={toggleMobileMenu}>Contact</Link>
          <Link href="/tickets" className="mt-2 flex bg-[#ff5a1f] text-white px-6 py-3 rounded-full justify-center items-center gap-2" onClick={toggleMobileMenu}>
            Book Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </header>
  );
}
