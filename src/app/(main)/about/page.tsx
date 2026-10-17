import Link from "next/link";
import { ArrowRight, Trophy, Sparkles, Compass, CheckCircle2, Flag } from "lucide-react";

export default function AboutPage() {
  const experiences = [
    {
      icon: "🏎️",
      title: "RC Race & Drift Tracks",
      desc: "Speed through our expertly designed RC racing and drifting circuits!"
    },
    {
      icon: "🚜",
      title: "RC Mining Zone",
      desc: "Experience the thrill of operating RC excavators, dump trucks, and loaders in a realistic mining setup!"
    },
    {
      icon: "✈️",
      title: "RC Airport Model",
      desc: "Watch RC planes taxi, take off, and land in a scaled-down aviation wonderland!"
    },
    {
      icon: "🚂",
      title: "RC Train World",
      desc: "Explore our fully functional miniature railway system with detailed landscapes, stations, and tracks."
    },
    {
      icon: "🏛️",
      title: "Iconic Landmark Models",
      desc: "Walk through breathtaking scaled replicas of famous locations like Mysore Palace, UB City, High Court, Vidhana Soudha, and more!"
    }
  ];

  const whyChooseUs = [
    "India's Most Unique RC Entertainment Zone",
    "Engaging & Family-Friendly Fun for All Ages",
    "A Perfect Blend of Learning & Play",
    "Expertly Designed for RC Enthusiasts"
  ];

  return (
    <div className="bg-white flex-grow text-[#0d1b2a]">
      {/* Hero Header & Story */}
      <section className="relative pt-12 pb-16 sm:pt-16 sm:pb-20 bg-gradient-to-b from-[#f8f9fa] via-white to-white border-b border-gray-100 overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#ff5a1f]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#0d1b2a]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black tracking-widest text-[#ff5a1f] uppercase bg-[#ff5a1f]/10 border border-[#ff5a1f]/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>OUR STORY</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-heading font-black tracking-tight uppercase leading-[0.95] text-[#0d1b2a]">
                From Passion <br />
                <span className="text-[#ff5a1f]">to Action!</span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-700 font-medium leading-relaxed">
                Welcome to <strong className="text-gray-900 font-bold">Havoc RC Funzone</strong> — India's first-of-its-kind destination where RC excitement meets real-world adventure!
              </p>

              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-gray-200/80 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-700">
                  <Compass className="w-4 h-4" />
                  <span>Our Mission &amp; Vision</span>
                </div>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed font-normal">
                  Launched by <strong className="text-gray-900 font-semibold">Havoc Hobby Center Pvt. Ltd.</strong>, Havoc RC Funzone is built for thrill-seekers, hobbyists, and families who love the excitement of RC racing, drifting, and exploring intricate miniature worlds.
                </p>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed font-normal">
                  We bring technology, creativity, and fun together in an immersive RC experience like no other. Whether you want to race, drift, operate excavators, or admire scaled landmarks, we've got the perfect adventure waiting for you.
                </p>
              </div>

              {/* Stat counters / quick highlights */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-1">
                <div className="bg-[#f8f9fa] border border-gray-200/70 rounded-xl p-3 sm:p-4 text-center">
                  <span className="block text-2xl sm:text-3xl font-black font-heading text-[#ff5a1f]">15+</span>
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">Activities</span>
                </div>
                <div className="bg-[#f8f9fa] border border-gray-200/70 rounded-xl p-3 sm:p-4 text-center">
                  <span className="block text-2xl sm:text-3xl font-black font-heading text-[#0d1b2a]">5+</span>
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">Themed Zones</span>
                </div>
                <div className="bg-[#f8f9fa] border border-gray-200/70 rounded-xl p-3 sm:p-4 text-center">
                  <span className="block text-2xl sm:text-3xl font-black font-heading text-[#ff5a1f]">100%</span>
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">Pure Thrill</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-4 items-center">
                <Link
                  href="/tickets"
                  className="bg-[#ff5a1f] hover:bg-[#e04812] text-white px-8 py-4 rounded-full font-bold text-sm transition-all shadow-lg shadow-[#ff5a1f]/25 flex items-center gap-2"
                >
                  Book Your Experience <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/gallery"
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-7 py-4 rounded-full font-bold text-sm transition-colors"
                >
                  View Arena Gallery
                </Link>
              </div>
            </div>

            {/* Right Visual Collage */}
            <div className="lg:col-span-5">
              <div className="relative">
                {/* Main featured image card */}
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/3] sm:aspect-[16/11] bg-gray-100 group">
                  <img
                    src="/gallery/img4.jpg"
                    alt="Havoc RC Funzone Main Arena"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <span className="inline-block bg-[#ff5a1f] text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-md mb-1.5">
                      Live Experience
                    </span>
                    <p className="text-sm font-bold drop-shadow">State-of-the-art Scale RC Miniatures &amp; Mining Arena</p>
                  </div>
                </div>

                {/* Sub-grid of thumbnails below hero */}
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="rounded-xl overflow-hidden shadow-md border-2 border-white aspect-[4/3] bg-gray-100 group">
                    <img
                      src="/gallery/img2.jpg"
                      alt="Miniature Airport & Rail"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="rounded-xl overflow-hidden shadow-md border-2 border-white aspect-[4/3] bg-gray-100 group">
                    <img
                      src="/gallery/img5.jpg"
                      alt="Excavator & Crane Works"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="rounded-xl overflow-hidden shadow-md border-2 border-white aspect-[4/3] bg-gray-100 group">
                    <img
                      src="/gallery/img1.jpg"
                      alt="Track Heavy Duty Drift"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                </div>

                {/* Floating Badge */}
                <div className="absolute -top-4 -right-4 bg-[#0d1b2a] text-white px-4 py-2.5 rounded-2xl shadow-xl border border-white/20 flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider">India's #1 RC Zone</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* What Awaits You? */}
      <section className="pt-14 pb-14 bg-[#f8f9fa] border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-3 uppercase flex items-center justify-center gap-2">
              <Flag className="w-4 h-4" />
              <span>ACTIVITIES &amp; ADVENTURES</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-heading font-black tracking-tight uppercase text-gray-900">
              What Awaits You?
            </h2>
            <p className="text-gray-600 mt-3 text-sm sm:text-base font-medium">
              Every corner of Havoc RC Funzone is packed with interactive RC engineering and miniature marvels.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {experiences.map((exp, idx) => (
              <div 
                key={idx}
                className="bg-white p-7 rounded-3xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="text-3xl mb-3.5 p-2.5 bg-gray-50 rounded-2xl w-fit">
                    {exp.icon}
                  </div>
                  <h3 className="text-lg font-bold font-heading text-gray-900 mb-1.5">
                    {exp.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed font-medium">
                    {exp.desc}
                  </p>
                </div>
              </div>
            ))}

            {/* 6th Card - Consistent with the group */}
            <div className="bg-white p-7 rounded-3xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="text-3xl mb-3.5 p-2.5 bg-orange-50 rounded-2xl w-fit">
                  🚀
                </div>
                <h3 className="text-lg font-bold font-heading text-gray-900 mb-1.5">
                  Ready for the Adventure?
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed font-medium">
                  Come and experience the thrill of RC like never before! Ready to drive, drift, and explore?
                </p>
              </div>
              <div className="pt-4">
                <Link
                  href="/tickets"
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#ff5a1f] hover:text-[#e04812] transition-colors"
                >
                  Book Your Slot &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Havoc RC Funzone? */}
      <section className="pt-6 pb-16 sm:pb-20 bg-[#f8f9fa]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-[#0d1b2a] via-[#112236] to-[#0d1b2a] rounded-3xl text-white p-8 sm:p-14 lg:p-16 shadow-xl relative overflow-hidden">
            
            {/* Background Accent glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff5a1f]/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-[#ff5a1f] mb-6">
                <Trophy className="w-3.5 h-3.5" />
                <span>EXCELLENCE IN HOBBY ENTERTAINMENT</span>
              </div>
              
              <h2 className="text-3xl sm:text-5xl font-heading font-black uppercase tracking-tight mb-8">
                Why Havoc RC Funzone?
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
                {whyChooseUs.map((reason, i) => (
                  <div key={i} className="flex items-start gap-3.5 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <CheckCircle2 className="w-5 h-5 text-[#ff5a1f] shrink-0 mt-0.5" />
                    <span className="font-bold text-white text-base leading-snug">
                      {reason}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-6">
                <Link
                  href="/tickets"
                  className="bg-[#ff5a1f] hover:bg-[#e04812] text-white px-8 py-4 rounded-full font-bold text-sm transition-all shadow-lg shadow-[#ff5a1f]/30 flex items-center gap-2"
                >
                  Plan Your Visit Now <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/contact"
                  className="text-white hover:text-[#ff5a1f] font-bold text-sm transition-colors"
                >
                  Contact Our Team &rarr;
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
