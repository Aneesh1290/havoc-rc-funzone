import Link from "next/link";
import { ArrowRight, MapPin, Clock } from "lucide-react";
import Image from "next/image";

export default function Home() {
  return (
    <>
      {/* HERO SECTION */}
      <section className="relative overflow-hidden min-h-[80svh] flex flex-col lg:block pt-0 pb-0 bg-white">
        
        {/* Full Background Image */}
        <div className="absolute inset-0 z-0">
          <img src="/rc_car.png" alt="Havoc RC Funzone" className="w-full h-full object-cover object-[75%_center] lg:object-center" />
          
          {/* Mobile Overlay: Smooth gradient fade to integrate text and image */}
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/100 to-transparent h-[90svh] lg:hidden"></div>
        </div>



        <div className="w-full flex flex-col h-full lg:min-h-[80svh] relative z-10">
          <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 lg:max-w-7xl lg:mx-auto lg:px-8 w-full items-start lg:items-stretch h-full flex-grow px-4 sm:px-6 lg:px-0">
            
            {/* Left Side (Text & Stats) */}
            <div className="lg:col-span-7 flex flex-col justify-start z-20 pt-4 pb-4 lg:pt-24 lg:pb-12 h-full w-full">
              
              <div className="relative z-10 flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-[13px] font-bold tracking-widest text-[#ff5a1f] mb-6 lg:mt-0">
                <span>RC CARS</span>
                <span className="w-1 h-1 bg-[#ff5a1f] rounded-full"></span>
                <span>DRONES</span>
                <span className="w-1 h-1 bg-[#ff5a1f] rounded-full"></span>
                <span>TRAINS</span>
                <span className="w-1 h-1 bg-[#ff5a1f] rounded-full"></span>
                <span>MINIATURES</span>
              </div>
              
              <h1 className="text-[3.5rem] leading-[0.9] sm:text-7xl lg:text-[100px] font-heading font-black text-[#0d1b2a] mb-6 sm:mb-8 tracking-tighter uppercase">
                A WORLD<br />
                BUILT TO<br />
                <span className="text-[#ff5a1f]">PLAY.</span>
              </h1>
              
              <p className="text-base sm:text-lg text-gray-700 font-sans mb-8 sm:mb-10 max-w-lg leading-relaxed font-medium">
                Havoc RC Funzone is Bengaluru's ultimate destination for RC racing, drones, miniature trains and immersive hobby experiences — all under one roof.
              </p>
              
              <div className="flex flex-wrap items-center gap-4 lg:mb-16">
                <Link href="/tickets" className="bg-[#ff5a1f] hover:bg-[#e04812] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-sans text-[14px] sm:text-[15px] font-bold transition-all flex items-center gap-2 shadow-xl shadow-[#ff5a1f]/30 border border-transparent">
                  Book Your Experience <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            
            {/* Right Side (Spacer on Mobile, Spacer on Desktop) */}
            <div className="lg:col-span-5 relative w-full min-h-[300px] lg:h-full z-10 flex-grow pointer-events-none mt-auto">
              <div className="absolute bottom-8 right-0 sm:right-6 lg:bottom-12 lg:right-8 z-20">
                <p className="font-handwritten text-4xl lg:text-5xl text-white leading-tight drop-shadow-md transform -rotate-6 text-right opacity-90 pr-2 lg:pr-0">
                  For Racers,<br />Explorers &<br />Dreamers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* MORE THAN JUST AN RC TRACK */}
      <section className="pt-6 sm:pt-8 pb-0 sm:pb-4 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
            <div className="lg:col-span-5 relative z-10">
              <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-3 sm:mb-4 flex items-center gap-4">
                <div className="w-6 h-px bg-[#ff5a1f]"></div>
                SOMETHING FOR EVERY ENTHUSIAST
              </div>
              <h2 className="text-4xl sm:text-6xl font-heading font-black text-[#0d1b2a] leading-[0.95] mb-4 sm:mb-6 tracking-tight">
                MORE THAN<br />
                JUST AN<br />
                <span className="text-[#ff5a1f]">RC TRACK.</span>
              </h2>
              <p className="text-base sm:text-lg text-gray-600 mb-2 sm:mb-8 max-w-md">
                From high-speed RC cars to drones, miniature railways, aircraft models and sim racing — there's always something to see, learn and play.
              </p>
            </div>
            
            <div className="lg:col-span-7 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-handwritten text-3xl sm:text-5xl text-[#ff5a1f]/80 z-20 whitespace-nowrap -rotate-12 bg-white/95 px-3 py-2 sm:p-4 rounded-xl shadow-lg border border-orange-100">
                Hobby Meets Imagination.
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 relative z-10">
                <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-12">
                  <div className="w-full aspect-[4/5] rounded-2xl bg-gray-200 overflow-hidden shadow-lg transform -rotate-2 hover:rotate-0 transition-transform">
                    <img src="/child_playing.png" alt="Child playing" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-full aspect-[3/2] rounded-2xl bg-gray-200 overflow-hidden shadow-lg transform rotate-2 hover:rotate-0 transition-transform">
                    <img src="/train.png" alt="Miniature Train" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  <div className="w-full aspect-[3/2] rounded-2xl bg-gray-200 overflow-hidden shadow-lg transform rotate-1 hover:rotate-0 transition-transform">
                    <img src="/drone.png" alt="Drone" className="w-full h-full object-cover" />
                  </div>
                  <div className="w-full aspect-[4/5] rounded-2xl bg-gray-200 overflow-hidden shadow-lg transform -rotate-1 hover:rotate-0 transition-transform">
                    <img src="/racing.png" alt="Sim Racing" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOOKING CTA */}
      <section className="pt-2 sm:pt-6 pb-12 sm:pb-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 bg-gradient-to-r from-orange-50/60 via-white to-orange-50/30 p-8 sm:p-12 rounded-3xl border border-orange-100/80 shadow-sm">
            <div className="max-w-2xl text-center md:text-left">
              <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-2 uppercase">Plan Your Visit</div>
              <h2 className="text-3xl sm:text-5xl font-heading font-black text-[#0d1b2a] leading-tight mb-3 sm:mb-4 tracking-tight uppercase">
                Book Your <span className="text-[#ff5a1f]">Experience</span>
              </h2>
              <p className="text-gray-600 text-base sm:text-lg">
                Select your activity, choose a slot and get ready for an unforgettable time at Havoc RC Funzone.
              </p>
            </div>
            <div className="shrink-0">
              <Link href="/tickets" className="inline-flex bg-[#ff5a1f] hover:bg-[#e04812] text-white px-8 py-4 rounded-full font-sans text-sm font-bold transition-all shadow-lg shadow-[#ff5a1f]/25 items-center gap-2 group">
                Book Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT / PLAYGROUND */}
      <section className="bg-[#0d1b2a] text-white">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          <div className="p-12 lg:p-24 flex flex-col justify-center">
            <div className="text-xs font-bold tracking-widest text-gray-400 mb-6 uppercase">HAVOC RC FUNZONE</div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-black leading-[1] mb-8 tracking-tight uppercase">
              A PLAYGROUND<br/>FOR CURIOSITY,<br/>CREATIVITY AND<br/><span className="text-[#ff5a1f]">COMMUNITY.</span>
            </h2>
            <p className="text-gray-300 text-lg mb-10 max-w-md">
              At Havoc RC Funzone, we bring together people of all ages through the excitement of RC models, drones, trains and more. It's a place to learn, compete, explore and simply have fun.
            </p>
            <div>
              <Link href="/about" className="inline-flex border border-gray-600 hover:bg-white hover:text-[#0d1b2a] px-6 py-3 rounded-full font-sans text-sm font-bold transition-all items-center gap-2">
                About Havoc <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="h-[400px] lg:h-auto bg-[url('https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&q=80')] bg-cover bg-center">
          </div>
        </div>
      </section>


    </>
  );
}
