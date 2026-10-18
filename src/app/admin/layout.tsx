"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Ticket, Tag, Settings, LogOut, X, Sparkles, Clock } from "lucide-react";
import { logoutAction } from "../login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [adminName, setAdminName] = useState("Admin User");
  const [adminRole, setAdminRole] = useState("Administrator");
  const [profileImage, setProfileImage] = useState<string | null>("https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80");
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState(adminName);
  const [tempRole, setTempRole] = useState(adminRole);
  const [tempImage, setTempImage] = useState<string | null>(profileImage);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("havoc_admin_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name) setAdminName(parsed.name);
        if (parsed.role) setAdminRole(parsed.role);
        if (parsed.image !== undefined) setProfileImage(parsed.image);
      } catch (e) {
        console.error("Failed to parse profile data");
      }
    }
  }, []);

  const handleSaveProfile = () => {
    setAdminName(tempName);
    setAdminRole(tempRole);
    setProfileImage(tempImage);
    
    localStorage.setItem("havoc_admin_profile", JSON.stringify({
      name: tempName,
      role: tempRole,
      image: tempImage
    }));
    
    setIsEditingProfile(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'AU';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0d1b2a] text-white flex flex-col shrink-0">
        <div className="py-6 flex items-center justify-center border-b border-gray-800">
          <Link href="/" className="flex items-center px-4 w-full">
            <img src="/logo_dark.png" alt="Havoc RC Funzone Logo" className="w-full h-auto object-contain" />
          </Link>
        </div>

        <nav className="flex-grow py-6 px-4 space-y-2">
          <Link href="/admin/bookings" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${pathname === '/admin/bookings' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <CalendarDays className={`w-5 h-5 ${pathname === '/admin/bookings' ? 'text-[#ff5a1f]' : ''}`} />
            Bookings
          </Link>
          <Link href="/admin/tickets" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${pathname === '/admin/tickets' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <Ticket className={`w-5 h-5 ${pathname === '/admin/tickets' ? 'text-[#ff5a1f]' : ''}`} />
            Ticket Types
          </Link>
          <Link href="/admin/vip-perks" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${pathname === '/admin/vip-perks' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <Sparkles className={`w-5 h-5 ${pathname === '/admin/vip-perks' ? 'text-[#ff5a1f]' : ''}`} />
            VIP Perks (Sims)
          </Link>
          <Link href="/admin/slots" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${pathname === '/admin/slots' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <Clock className={`w-5 h-5 ${pathname === '/admin/slots' ? 'text-[#ff5a1f]' : ''}`} />
            Slots &amp; Dates
          </Link>
          <Link href="/admin/coupons" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${pathname === '/admin/coupons' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <Tag className={`w-5 h-5 ${pathname === '/admin/coupons' ? 'text-[#ff5a1f]' : ''}`} />
            Coupons
          </Link>
          <Link href="/admin/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${pathname === '/admin/settings' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <Settings className={`w-5 h-5 ${pathname === '/admin/settings' ? 'text-[#ff5a1f]' : ''}`} />
            Settings
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <form action={logoutAction}>
            <button type="submit" className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 font-medium transition-colors">
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <h2 className="text-xl font-bold text-gray-800">
            {pathname.includes('/bookings') ? 'Bookings' : 
             pathname.includes('/tickets') ? 'Ticket Types' : 
             pathname.includes('/vip-perks') ? 'VIP Perks & Simulators' : 
             pathname.includes('/coupons') ? 'Coupons' : 
             pathname.includes('/settings') ? 'Settings' : 'Admin Portal'}
          </h2>
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center gap-4 cursor-pointer hover:bg-gray-100 p-2 rounded-lg -m-2 transition-colors"
              onClick={() => {
                setTempName(adminName);
                setTempRole(adminRole);
                setTempImage(profileImage);
                setIsEditingProfile(true);
              }}
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden shrink-0 flex items-center justify-center text-sm font-medium text-gray-600">
                {profileImage ? (
                  <img src={profileImage} alt="Admin" className="w-full h-full object-cover" />
                ) : (
                  getInitials(adminName)
                )}
              </div>
              <div className="text-sm">
                <p className="font-bold text-gray-900">{adminName}</p>
                <p className="text-gray-500">{adminRole}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-grow p-8 overflow-y-auto relative">
          {children}
        </div>

        {/* Edit Profile Modal */}
        {isEditingProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
              <button 
                onClick={() => setIsEditingProfile(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-xl font-serif text-gray-900 mb-6">Edit Profile</h2>

              <div className="flex flex-col items-center mb-8">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-3xl font-medium text-gray-700 mb-4 overflow-hidden border-4 border-gray-50 shadow-sm">
                  {tempImage ? (
                    <img src={tempImage} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(tempName)
                  )}
                </div>
                <div className="flex gap-4 text-sm font-semibold">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[#0d1b2a] hover:text-gray-600 transition-colors"
                  >
                    Change Photo
                  </button>
                  <button 
                    onClick={() => setTempImage(null)}
                    className="text-red-500 hover:text-red-600 transition-colors"
                  >
                    Remove Photo
                  </button>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-bold text-[#0d1b2a] mb-1.5">Name</label>
                  <input 
                    type="text" 
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 focus:border-[#0d1b2a] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#0d1b2a] mb-1.5">Role</label>
                  <input 
                    type="text" 
                    value={tempRole}
                    onChange={(e) => setTempRole(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0d1b2a]/20 focus:border-[#0d1b2a] transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button 
                  onClick={() => setIsEditingProfile(false)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-[#0d1b2a] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveProfile}
                  className="px-6 py-2.5 bg-[#0d1b2a] rounded-lg text-sm font-bold text-white hover:bg-gray-900 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
