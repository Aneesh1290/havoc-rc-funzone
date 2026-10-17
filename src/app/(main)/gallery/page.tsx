"use client";

import { useState } from "react";
import { Camera, ZoomIn, X, ChevronLeft, ChevronRight } from "lucide-react";

export default function GalleryPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const galleryItems = [
    {
      src: "/gallery/img1.jpg",
      title: "RC Heavy Construction & Hauler Track",
      category: "tracks",
      description: "Scale commercial transport trucks navigating the precision paved circuit and transport terminal."
    },
    {
      src: "/gallery/img2.jpg",
      title: "Miniature Railway & Aero Display",
      category: "miniatures",
      description: "High-flying scale jet suspend above the vintage HO scale passenger train crossing the scenic landmark replicas."
    },
    {
      src: "/gallery/img3.jpg",
      title: "Elevated Aviation & Arena Panorama",
      category: "arena",
      description: "The full arena view showcasing suspended aerobatic flyers, spectators walkway, and miniature diorama layout."
    },
    {
      src: "/gallery/img4.jpg",
      title: "Mining Tipper & City Layout Track",
      category: "tracks",
      description: "Heavy hydraulic dump trucks cruising past the city centre, rail bridge, and miniature construction crane."
    },
    {
      src: "/gallery/img5.jpg",
      title: "Heavy Equipment Quarry & Excavator Depot",
      category: "tracks",
      description: "Aerial view of the scale earthmoving zone featuring RC hydraulic excavators, tower crane, and dumpers."
    }
  ];

  const filteredItems = activeFilter === "all" 
    ? galleryItems 
    : galleryItems.filter(item => item.category === activeFilter);

  const handleNext = () => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex + 1) % filteredItems.length);
    }
  };

  const handlePrev = () => {
    if (selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex - 1 + filteredItems.length) % filteredItems.length);
    }
  };

  return (
    <div className="py-16 sm:py-24 bg-white flex-grow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-gray-100 pb-8 gap-6">
          <div>
            <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-3 uppercase flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span>EXPLORE THE FUNZONE</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-heading font-black text-[#0d1b2a] tracking-tight uppercase">
              GALLERY
            </h1>
            <p className="text-gray-500 mt-2 max-w-xl text-base sm:text-lg font-medium">
              Take a tour through our miniature worlds, high-speed RC tracks, scale railways, and aerial showcases.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "All Photos" },
              { id: "tracks", label: "RC Tracks & Vehicles" },
              { id: "miniatures", label: "Miniature World" },
              { id: "arena", label: "Arena Overview" },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => {
                  setActiveFilter(filter.id);
                  setSelectedImageIndex(null);
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  activeFilter === filter.id
                    ? "bg-[#0d1b2a] text-white shadow-md shadow-gray-900/20"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => {
            // Apply varied card span to give a dynamic editorial layout
            const isFeatured = index === 1; // Vertical shot looks amazing with taller height
            return (
              <div
                key={item.src}
                onClick={() => setSelectedImageIndex(index)}
                className={`group relative rounded-3xl overflow-hidden bg-gray-900 border border-gray-100 shadow-sm cursor-pointer transition-all duration-500 hover:shadow-xl hover:-translate-y-1 ${
                  isFeatured ? "md:row-span-2 md:h-full min-h-[420px]" : "h-80 sm:h-96"
                }`}
              >
                <img
                  src={item.src}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />

                {/* Subtle dark gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-80 group-hover:opacity-95 transition-opacity duration-300"></div>

                {/* Top Badge & Zoom Icon */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/90 text-gray-900 backdrop-blur-md shadow-sm">
                    {item.category}
                  </span>
                  <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 border border-white/20">
                    <ZoomIn className="w-4 h-4" />
                  </div>
                </div>

                {/* Bottom Caption */}
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white transform transition-transform duration-300">
                  <h3 className="text-lg sm:text-xl font-black font-heading tracking-wide mb-1 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-300 line-clamp-2 font-medium leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Lightbox Modal */}
      {selectedImageIndex !== null && filteredItems[selectedImageIndex] && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
          <button
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors z-50"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors z-50"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>

          {/* Next Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors z-50"
          >
            <ChevronRight className="w-7 h-7" />
          </button>

          {/* Image & Caption Container */}
          <div className="max-w-5xl w-full flex flex-col items-center max-h-[90vh]">
            <div className="relative max-h-[75vh] w-full flex items-center justify-center overflow-hidden rounded-2xl">
              <img
                src={filteredItems[selectedImageIndex].src}
                alt={filteredItems[selectedImageIndex].title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl"
              />
            </div>
            <div className="text-center mt-4 max-w-2xl text-white">
              <h2 className="text-xl sm:text-2xl font-bold font-heading">
                {filteredItems[selectedImageIndex].title}
              </h2>
              <p className="text-sm text-gray-300 mt-1">
                {filteredItems[selectedImageIndex].description}
              </p>
              <div className="text-xs text-[#ff5a1f] font-bold mt-2 tracking-widest uppercase">
                {selectedImageIndex + 1} of {filteredItems.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
