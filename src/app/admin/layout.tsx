"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Ticket, Tag, Settings, LogOut, X, Sparkles, Clock, Users, Menu } from "lucide-react";
import { logoutAction } from "../login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [adminName, setAdminName] = useState("Admin User");
  const [adminRole, setAdminRole] = useState("Administrator");
  const [profileImage, setProfileImage] = useState<string | null>("https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80");
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState(adminName);
  const [tempRole, setTempRole] = useState(adminRole);
  const [tempImage, setTempImage] = useState<string | null>(profileImage);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const [sessionUser, setSessionUser] = useState<{ username: string; role: string; permissions: string } | null>(null);

  // Load from localStorage on mount and sync session
  useEffect(() => {
    // 1. Fetch real session info from token
    fetch("/api/auth/session")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) {
          setSessionUser(data.user);
          if (data.user.username) setAdminName(data.user.username);
          if (data.user.role) {
            setAdminRole(data.user.role === "super_admin" ? "Super Admin" : (data.user.role === "staff" ? "Staff Member" : "Administrator"));
          }
        }
      })
      .catch(() => {});

    // 2. Profile preferences from localStorage if exists
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

  const allNavLinks = [
    { href: "/admin/bookings", key: "bookings", label: "Bookings", icon: CalendarDays },
    { href: "/admin/tickets", key: "tickets", label: "Ticket Types", icon: Ticket },
    { href: "/admin/vip-perks", key: "vip-perks", label: "VIP Perks (Sims)", icon: Sparkles },
    { href: "/admin/slots", key: "slots", label: "Slots & Dates", icon: Clock },
    { href: "/admin/coupons", key: "coupons", label: "Coupons", icon: Tag },
    { href: "/admin/staff", key: "staff", label: "Staff", icon: Users },
    { href: "/admin/settings", key: "settings", label: "Settings", icon: Settings },
  ];

  // Filter tabs according to user permissions
  const navLinks = allNavLinks.filter((item) => {
    // If not loaded yet or primary admin/super_admin, show all
    if (!sessionUser) return true;
    if (sessionUser.username === "admin" || sessionUser.role === "super_admin" || sessionUser.permissions === "all") {
      return true;
    }
    // Staff users cannot access staff accounts management
    if (item.key === "staff") return false;

    const userPerms = (sessionUser.permissions || "").split(",").map(p => p.trim());
    return userPerms.includes(item.key);
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Desktop: fixed/relative w-64, Mobile: off-canvas drawer */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 lg:w-64 bg-[#0d1b2a] text-white flex flex-col shrink-0 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-800">
          <Link href="/" className="flex items-center w-full max-w-[170px]" onClick={() => setIsMobileMenuOpen(false)}>
            <img src="/logo_dark.png" alt="Havoc RC Funzone Logo" className="w-full h-auto object-contain max-h-12" />
          </Link>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-grow py-6 px-4 space-y-1.5 overflow-y-auto">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link 
                key={item.href}
                href={item.href} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive 
                    ? 'bg-white/10 text-white font-semibold' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#ff5a1f]' : ''}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
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

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col min-w-0 w-full">
        {/* Top Header */}
        <header className="h-16 lg:h-20 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger button for mobile */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
              aria-label="Open sidebar navigation"
            >
              <Menu className="w-6 h-6" />
            </button>

            <h2 className="text-base sm:text-xl font-bold text-gray-800 truncate">
              {pathname.includes('/bookings') ? 'Bookings' : 
               pathname.includes('/tickets') ? 'Ticket Types' : 
               pathname.includes('/vip-perks') ? 'VIP Perks & Simulators' : 
               pathname.includes('/slots') ? 'Slots & Dates' :
               pathname.includes('/coupons') ? 'Coupons' : 
               pathname.includes('/staff') ? 'Staff Accounts' :
               pathname.includes('/settings') ? 'Settings' : 'Admin Portal'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div 
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer hover:bg-gray-100 p-1.5 sm:p-2 rounded-xl transition-colors"
              onClick={() => {
                setTempName(adminName);
                setTempRole(adminRole);
                setTempImage(profileImage);
                setIsEditingProfile(true);
              }}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-200 border-2 border-white shadow-sm overflow-hidden shrink-0 flex items-center justify-center text-xs sm:text-sm font-medium text-gray-600">
                {profileImage ? (
                  <img src={profileImage} alt="Admin" className="w-full h-full object-cover" />
                ) : (
                  getInitials(adminName)
                )}
              </div>
              <div className="text-left hidden sm:block">
                <p className="font-bold text-gray-900 text-sm leading-tight">{adminName}</p>
                <p className="text-xs text-gray-500 leading-tight">{adminRole}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto relative w-full min-w-0">
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
