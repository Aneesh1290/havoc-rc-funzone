import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#0d1b2a] text-white pt-14 pb-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 mb-12">
          <div className="lg:w-1/3 shrink-0 flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="mb-6 inline-block bg-white p-4 rounded-2xl shadow-lg border border-gray-100">
              <img src="/logo.png" alt="Havoc RC Funzone Logo" className="h-[64px] sm:h-[80px] w-auto object-contain" />
            </div>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed max-w-sm">
              India's premier RC destination. High-speed racing, precision drifting, mining zones &amp; miniature worlds.
            </p>
          </div>
          
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-8">
            {/* 3 Quick Navigation Columns grouped on mobile */}
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:contents gap-4 sm:gap-6 col-span-1 sm:col-span-2 lg:col-span-3">
              {/* Explore column */}
              <div>
                <h4 className="font-bold text-white mb-4 sm:mb-5 uppercase tracking-wider text-xs sm:text-sm">Explore</h4>
                <ul className="space-y-2.5 sm:space-y-3 text-[14px] sm:text-[15px] text-gray-300">
                  <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                  <li><Link href="/tickets" className="hover:text-white transition-colors">Book Slots</Link></li>
                  <li><Link href="/gallery" className="hover:text-white transition-colors">Gallery</Link></li>
                </ul>
              </div>
              
              {/* About column */}
              <div>
                <h4 className="font-bold text-white mb-4 sm:mb-5 uppercase tracking-wider text-xs sm:text-sm">About</h4>
                <ul className="space-y-2.5 sm:space-y-3 text-[14px] sm:text-[15px] text-gray-300">
                  <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
                  <li><Link href="/team" className="hover:text-white transition-colors">Our Team</Link></li>
                  <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                </ul>
              </div>
              
              {/* Support column */}
              <div>
                <h4 className="font-bold text-white mb-4 sm:mb-5 uppercase tracking-wider text-xs sm:text-sm">Support &amp; Legal</h4>
                <ul className="space-y-2.5 sm:space-y-3 text-[14px] sm:text-[15px] text-gray-300">
                  <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
                  <li><Link href="/refund" className="hover:text-white transition-colors">Refund &amp; Cancellation</Link></li>
                  <li><Link href="/shipping" className="hover:text-white transition-colors">Shipping &amp; Delivery</Link></li>
                  <li><Link href="/accessibility" className="hover:text-white transition-colors">Accessibility</Link></li>
                </ul>
              </div>
            </div>

            {/* Contact column */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-1 pt-4 sm:pt-0 border-t border-gray-800/80 sm:border-0">
              <h4 className="font-bold text-white mb-4 sm:mb-5 uppercase tracking-wider text-xs sm:text-sm">Contact Us</h4>
              <ul className="space-y-2.5 sm:space-y-3 text-[14px] sm:text-[15px] text-gray-300">
                <li>
                  <a 
                    href="mailto:havocrcfunzone@gmail.com" 
                    className="hover:text-white transition-colors text-[#ff5a1f] font-semibold block"
                  >
                    havocrcfunzone@gmail.com
                  </a>
                </li>
                <li>
                  <a href="tel:+918951336255" className="hover:text-[#ff5a1f] transition-colors font-bold text-white block">
                    +91 89513 36255
                  </a>
                </li>
                <li className="text-gray-400 text-xs sm:text-sm leading-relaxed pt-1">
                  No. 90, Sabharwal Residency Building, 4th Floor, KH Double Road, Above KFC Shantinagar KH, Bengaluru 560027
                </li>
                <li className="pt-2">
                  <div className="flex items-center gap-3">
                    <a 
                      href="https://instagram.com/havocrcfunzone" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#ff5a1f] flex items-center justify-center text-xs font-bold transition-all text-white"
                      title="Follow on Instagram"
                    >
                      IG
                    </a>
                    <a 
                      href="https://facebook.com/havocrcfunzone" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#ff5a1f] flex items-center justify-center text-xs font-bold transition-all text-white"
                      title="Follow on Facebook"
                    >
                      FB
                    </a>
                    <a 
                      href="https://wa.me/918951336255" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-emerald-600 flex items-center justify-center text-xs font-bold transition-all text-white"
                      title="Chat on WhatsApp"
                    >
                      WA
                    </a>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Payment Badges & Security Bar */}
        <div className="border-t border-gray-800/80 pt-6 pb-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-gray-400 font-semibold mr-1">We Accept:</span>
            <span className="bg-white text-blue-900 font-black px-2 py-0.5 rounded text-[10px] tracking-wider">VISA</span>
            <span className="bg-white text-red-600 font-bold px-2 py-0.5 rounded text-[10px]">Mastercard</span>
            <span className="bg-white text-orange-600 font-bold px-2 py-0.5 rounded text-[10px]">RuPay</span>
            <span className="bg-white text-blue-600 font-bold px-2 py-0.5 rounded text-[10px]">AMEX</span>
            <span className="bg-white text-slate-800 font-bold px-2 py-0.5 rounded text-[10px]">Diners</span>
            <span className="bg-white text-emerald-700 font-black px-2 py-0.5 rounded text-[10px]">UPI</span>
            <span className="bg-white text-gray-700 font-bold px-2 py-0.5 rounded text-[10px]">Net Banking</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>256-bit SSL Secure Checkout | ICICI Bank Orange Gateway</span>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500 text-center md:text-left">
            &copy; {new Date().getFullYear()} Havoc RC Funzone. All rights reserved.
          </p>
          <div className="text-sm text-gray-400">
            Developed by <a href="https://whynotdev.in" target="_blank" rel="noopener noreferrer" className="text-white font-bold hover:text-[#ff5a1f] transition-colors">WhyNotDev</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
