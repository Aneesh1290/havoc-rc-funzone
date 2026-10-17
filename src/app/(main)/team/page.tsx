"use client";

import { useState } from "react";
import Image from "next/image";

export default function TeamPage() {
  const [showBobbyBio, setShowBobbyBio] = useState(false);
  const [showRakhiBio, setShowRakhiBio] = useState(false);

  return (
    <div className="bg-white text-[#0d1b2a] pt-24 pb-20 flex-grow">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-4 uppercase">OUR LEADERSHIP</div>
          <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tight mb-8">
            MEET THE <span className="text-[#ff5a1f]">TEAM</span>
          </h1>
          <p className="text-lg sm:text-xl font-medium leading-relaxed text-gray-600">
            The visionaries behind Havoc Group, dedicated to bringing premium simulation and aviation experiences to India.
          </p>
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-12">
          
          {/* Bobby Sabharwal */}
          <div className="flex flex-col items-center">
            <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden mb-8 border-4 border-gray-100 shadow-2xl">
              <img src="/team/bobby.jpeg" alt="Bobby Sabharwal" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-4xl font-heading font-black mb-2 tracking-tight">Bobby Sabharwal</h2>
            <p className="text-xs sm:text-sm tracking-widest font-bold uppercase text-[#ff5a1f] mb-6">Founder, Managing Director & CEO</p>
            <button 
              onClick={() => setShowBobbyBio(!showBobbyBio)}
              className="text-[#0d1b2a] hover:text-[#ff5a1f] underline font-bold text-sm mb-10 transition-colors"
            >
              {showBobbyBio ? "Hide Bio" : "Show Bio"}
            </button>
            
            {showBobbyBio && (
              <div className="text-gray-600 font-medium space-y-6 text-base leading-relaxed text-left w-full px-4 sm:px-2">
                <p>
                  Bobby Sabharwal is the Founder, Managing Director and CEO of Havoc Group. His journey in aeromodelling began at the age of 15, driven by a deep passion for radio-controlled model aircraft, including RC planes and helicopters.
                </p>
                <p>
                  With decades of hands-on experience in aeromodelling, he transformed his passion into several innovative ventures, including Havoc Hobby, Havoc RC FunZone, Havoc Sim Podium, Havoc Fun School and Havoc Aviation.
                </p>
                <p>
                  His journey has evolved from aeromodelling and RC aviation to professional flight simulators and aviation education. Through Havoc Aviation, the Group is now expanding into pilot training support through ground school classes and advanced flight simulator training.
                </p>
                <p>
                  From Aeromodelling to Aviation, Bobby Sabharwal's journey has been driven by passion, innovation and a vision to make hobby technology, simulation and aviation education more accessible in India while inspiring the next generation of aviation enthusiasts and aspiring pilots.
                </p>
              </div>
            )}
          </div>

          {/* Rakhi */}
          <div className="flex flex-col items-center">
            <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden mb-8 border-4 border-gray-100 shadow-2xl">
              <img src="/team/rekha.jpeg" alt="Rakhi" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-4xl font-heading font-black mb-2 tracking-tight">Rakhi</h2>
            <p className="text-xs sm:text-sm tracking-widest font-bold uppercase text-[#ff5a1f] mb-6">Joint Director</p>
            <button 
              onClick={() => setShowRakhiBio(!showRakhiBio)}
              className="text-[#0d1b2a] hover:text-[#ff5a1f] underline font-bold text-sm mb-10 transition-colors"
            >
              {showRakhiBio ? "Hide Bio" : "Show Bio"}
            </button>
            
            {showRakhiBio && (
              <div className="text-gray-600 font-medium space-y-6 text-base leading-relaxed text-left w-full px-4 sm:px-2">
                <p>
                  Rakhi serves as the Joint Director of Havoc Group, playing an important role in the Group's leadership, administration and continued expansion. Working alongside Founder, Managing Director and CEO Bobby Sabharwal, she contributes to strategic planning, operational coordination and the development of new business ventures.
                </p>
                <p>
                  Since the establishment of Havoc Hobby Center in 2016, the organisation has grown from a specialised hobby destination into a diversified group of innovative ventures. These include Havoc Hobby, Havoc RC FunZone, Havoc Sim Podium, Havoc Fun School and Havoc Aviation.
                </p>
                <p>
                  Rakhi's commitment, organisational leadership and support have contributed to the Group's journey from RC hobbies and aeromodelling to experiential entertainment, professional flight and racing simulation, aviation education, ground-school learning and simulator-based pilot training.
                </p>
                <p>
                  As Joint Director, she remains committed to strengthening the Group's operations, supporting its team and helping transform ambitious ideas into meaningful experiences. Her vision is to contribute towards building Havoc Group as a trusted name in hobbies, simulation, education and aviation while inspiring young minds and aspiring pilots across India.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
