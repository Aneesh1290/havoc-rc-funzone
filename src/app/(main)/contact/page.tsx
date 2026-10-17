import { MapPin, Phone, Mail, Clock } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="py-8 sm:py-14 md:py-20 bg-white flex-grow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-2 sm:mb-4 uppercase">GET IN TOUCH</div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-heading font-black text-[#0d1b2a] tracking-tight mb-8 sm:mb-12">
          CONTACT US
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
          <div>
            <form className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#0d1b2a] mb-2">Name</label>
                <input type="text" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#0d1b2a] mb-2">Email</label>
                <input type="email" className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]" placeholder="your@email.com" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#0d1b2a] mb-2">Message</label>
                <textarea rows={4} className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]" placeholder="How can we help?"></textarea>
              </div>
              <button type="submit" className="bg-[#ff5a1f] text-white font-bold px-8 py-4 rounded-full w-full hover:bg-[#e04812] transition-colors">
                Send Message
              </button>
            </form>
          </div>
          
          <div className="space-y-8 bg-[#f8f9fa] p-8 md:p-12 rounded-3xl">
            <div className="flex gap-4">
              <MapPin className="w-6 h-6 text-[#ff5a1f] shrink-0" />
              <div>
                <h3 className="font-bold text-[#0d1b2a] mb-2">Visit Us</h3>
                <p className="text-gray-600">
                  No. 90, Sabharwal Residency<br />
                  Building, 4th Floor, KH Double Road<br />
                  Above KFC Shantinagar KH,<br />
                  Bengaluru, Karnataka 560027
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <Clock className="w-6 h-6 text-[#ff5a1f] shrink-0" />
              <div>
                <h3 className="font-bold text-[#0d1b2a] mb-2">Opening Hours</h3>
                <p className="text-gray-600">
                  Tuesday - Sunday: 11:00 AM - 10:00 PM<br />
                  (Closed 1:00 PM - 3:00 PM)<br />
                  Monday: Closed
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <Phone className="w-6 h-6 text-[#ff5a1f] shrink-0" />
              <div>
                <h3 className="font-bold text-[#0d1b2a] mb-2">Call Us</h3>
                <a href="tel:+918951336255" className="text-gray-600 hover:text-[#ff5a1f] transition-colors font-medium">
                  +91 89513 36255
                </a>
              </div>
            </div>

            {/* Map Embed */}
            <div className="w-full h-64 md:h-80 min-h-[250px] rounded-2xl overflow-hidden mt-8 border border-gray-200 shadow-sm">
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                marginHeight={0} 
                marginWidth={0} 
                src="https://maps.google.com/maps?width=100%25&amp;height=600&amp;hl=en&amp;q=No.%2090,%20Sabharwal%20Residency,%20Building,%204th%20Floor,%20KH%20Double%20Road,%20Above%20KFC%20Shantinagar%20KH,%20Bengaluru,%20Karnataka%20560027+(Havoc%20RC%20Funzone)&amp;t=&amp;z=15&amp;ie=UTF8&amp;iwloc=B&amp;output=embed"
                className="w-full h-full grayscale-[20%] contrast-125"
                style={{ filter: "opacity(0.9)" }}
              >
              </iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
