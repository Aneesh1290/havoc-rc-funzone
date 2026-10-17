"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Trash2, Plus, Edit2, Check, Power, Image as ImageIcon, ArrowUpDown, Loader2 } from "lucide-react";
import { 
  fetchVipPerksAction, 
  createVipPerkAction, 
  updateVipPerkAction, 
  toggleVipPerkStatusAction, 
  deleteVipPerkAction,
  syncSimPodiumSimulatorsAction
} from "@/app/actions/tickets";
import type { VipPerkRow } from "@/lib/db";

// Pre-defined available simulator assets from the repository for quick selection
const PRESET_IMAGES = [
  { label: "RC Flying Sim", path: "/simulators/uploads/1789025889762-rc-flying-sim.png" },
  { label: "Flight Sim Pro Airbus", path: "/simulators/flight-sim-pro(airbus).png" },
  { label: "Flight Sim Pro Boeing", path: "/simulators/flight-sim-pro(boeing).png" },
  { label: "Race Sim GT", path: "/simulators/race-sim-gt.png" },
  { label: "Race Sim F1", path: "/simulators/race-sim-f1.png" },
  { label: "Race Sim Beginner", path: "/simulators/race-sim-beginner.png" },
  { label: "Race Sim Jr & PS5", path: "/simulators/race-sim-jr.png" }
];

export default function VipPerksPage() {
  const [perks, setPerks] = useState<VipPerkRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPerk, setEditingPerk] = useState<VipPerkRow | null>(null);
  const [isAddingPerk, setIsAddingPerk] = useState(false);
  const [newPerk, setNewPerk] = useState({
    name: "",
    category: "Racing",
    tagline: "",
    image: "/simulators/race-sim-gt.png",
    sortOrder: 1
  });
  const [deleteConfirmPerk, setDeleteConfirmPerk] = useState<VipPerkRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadPerks = async () => {
    setIsLoading(true);
    const data = await fetchVipPerksAction(false); // get both active and inactive
    setPerks(data);
    setIsLoading(false);
  };

  const handleSyncSimPodium = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const res = await syncSimPodiumSimulatorsAction();
      if (!res.success) {
        setErrorMsg(res.error || "Failed to sync with Havoc Sim Podium");
      }
      await loadPerks();
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to sync with Havoc Sim Podium");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadPerks();
  }, []);

  const toggleStatus = async (id: number, currentActive: number) => {
    // Optimistic UI update
    setPerks(perks.map(p => p.id === id ? { ...p, active: currentActive ? 0 : 1 } : p));
    await toggleVipPerkStatusAction(id, currentActive !== 1);
    await loadPerks();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerk) return;
    if (!editingPerk.name.trim()) {
      setErrorMsg("Perk/Simulator name is required");
      return;
    }

    const res = await updateVipPerkAction(
      editingPerk.id,
      editingPerk.name,
      editingPerk.category,
      editingPerk.tagline,
      editingPerk.image,
      editingPerk.sort_order || 0
    );

    if (res.success) {
      setEditingPerk(null);
      await loadPerks();
    } else {
      setErrorMsg(res.error || "Failed to update VIP perk");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPerk.name.trim()) {
      setErrorMsg("Perk/Simulator name is required");
      return;
    }

    setErrorMsg(null);
    const res = await createVipPerkAction(
      newPerk.name,
      newPerk.category,
      newPerk.tagline,
      newPerk.image,
      newPerk.sortOrder
    );

    if (res.success) {
      setIsAddingPerk(false);
      setNewPerk({
        name: "",
        category: "Racing",
        tagline: "",
        image: "/simulators/race-sim-gt.png",
        sortOrder: perks.length + 1
      });
      await loadPerks();
    } else {
      setErrorMsg(res.error || "Failed to create VIP perk");
    }
  };

  const handleDelete = async (id: number) => {
    setErrorMsg(null);
    const res = await deleteVipPerkAction(id);
    if (res.success) {
      setDeleteConfirmPerk(null);
      await loadPerks();
    } else {
      setErrorMsg(res.error || "Failed to delete VIP perk");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Loading VIP perks &amp; simulator options...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#ff5a1f]" />
            <h1 className="text-3xl font-heading font-black text-gray-900">VIP Perks &amp; Simulators</h1>
          </div>
          <p className="text-gray-500 mt-1">
            Manage the simulator options that VIP Participant pass holders can choose during booking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncSimPodium}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-sm text-sm disabled:opacity-50"
            title="Fetch and sync latest simulators from Havoc Sim Podium"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 text-[#ff5a1f] animate-spin" />
            ) : (
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
            )}
            <span>{isSyncing ? "Syncing..." : "Sync with Sim Podium"}</span>
          </button>

          <button 
            onClick={() => {
              setErrorMsg(null);
              setNewPerk(prev => ({ ...prev, sortOrder: perks.length + 1 }));
              setIsAddingPerk(true);
            }}
            className="bg-[#0d1b2a] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add VIP Simulator</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Simulators</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{perks.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active for Booking</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {perks.filter(p => p.active === 1).length}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Disabled / Hidden</div>
          <div className="text-2xl font-black text-gray-400 mt-1">
            {perks.filter(p => p.active === 0).length}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wider font-bold bg-gray-50/50">
                <th className="py-3.5 px-4">Preview</th>
                <th className="py-3.5 px-4">Simulator / Perk Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Tagline / Description</th>
                <th className="py-3.5 px-4 text-center">Sort Order</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {perks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    No VIP perks added yet. Click &quot;Add VIP Simulator&quot; to create one.
                  </td>
                </tr>
              ) : (
                perks.map((perk) => (
                  <tr key={perk.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Thumbnail */}
                    <td className="py-3 px-4">
                      <div className="w-16 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center relative">
                        {perk.image ? (
                          <img 
                            src={perk.image} 
                            alt={perk.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{perk.name}</div>
                      <div className="text-[11px] text-gray-400">ID #{perk.id}</div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                        {perk.category}
                      </span>
                    </td>

                    {/* Tagline */}
                    <td className="py-3 px-4 max-w-xs truncate text-gray-600 text-xs">
                      {perk.tagline || <span className="text-gray-300 italic">None</span>}
                    </td>

                    {/* Order */}
                    <td className="py-3 px-4 text-center font-bold text-gray-600">
                      {perk.sort_order}
                    </td>

                    {/* Status Toggle (Click to Enable or Hide) */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleStatus(perk.id, perk.active)}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border whitespace-nowrap cursor-pointer ${
                          perk.active === 1
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                        }`}
                        title={perk.active === 1 ? "Click to Hide simulator" : "Click to Make Active"}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${perk.active === 1 ? "bg-emerald-500" : "bg-gray-400"}`}></span>
                        <span>{perk.active === 1 ? "Active" : "Hidden"}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Quick Hide/Show Toggle Action Button */}
                        <button
                          type="button"
                          onClick={() => toggleStatus(perk.id, perk.active)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            perk.active === 1 
                              ? "text-emerald-600 hover:bg-emerald-50" 
                              : "text-gray-400 hover:text-emerald-600 hover:bg-gray-100"
                          }`}
                          title={perk.active === 1 ? "Hide / Disable Simulator" : "Show / Enable Simulator"}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg(null);
                            setEditingPerk({ ...perk });
                          }}
                          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit simulator perk"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg(null);
                            setDeleteConfirmPerk(perk);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete simulator perk"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MODAL */}
      {isAddingPerk && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#ff5a1f]" />
                <h3 className="text-xl font-bold text-gray-900">Add VIP Simulator Perk</h3>
              </div>
              <button 
                onClick={() => setIsAddingPerk(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Simulator Name *
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Motion 4DOF Formula Rig"
                  value={newPerk.name}
                  onChange={(e) => setNewPerk({ ...newPerk, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={newPerk.category}
                    onChange={(e) => setNewPerk({ ...newPerk, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] bg-white"
                  >
                    <option value="Racing">Racing</option>
                    <option value="Flying">Flying</option>
                    <option value="Gaming & Racing">Gaming &amp; Racing</option>
                    <option value="VR & Flight">VR &amp; Flight</option>
                    <option value="Miniature Sim">Miniature Sim</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Sort Order
                  </label>
                  <input 
                    type="number" 
                    value={newPerk.sortOrder}
                    onChange={(e) => setNewPerk({ ...newPerk, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tagline / Description
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Pro Direct Drive Formula Racing Cockpit"
                  value={newPerk.tagline}
                  onChange={(e) => setNewPerk({ ...newPerk, tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Image Path / URL *
                </label>
                <input 
                  type="text" 
                  value={newPerk.image}
                  onChange={(e) => setNewPerk({ ...newPerk, image: e.target.value })}
                  placeholder="/simulators/race-sim-gt.png or custom image URL"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  required
                />
                
                {/* Preset Picker */}
                <div className="mt-2.5">
                  <div className="text-[11px] font-bold text-gray-500 mb-1.5">Quick choose from preset images:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_IMAGES.map((img) => (
                      <button
                        key={img.path}
                        type="button"
                        onClick={() => setNewPerk({ ...newPerk, image: img.path })}
                        className={`text-[11px] px-2 py-1 rounded-lg border transition-all ${
                          newPerk.image === img.path
                            ? "bg-[#ff5a1f]/10 text-[#ff5a1f] border-[#ff5a1f] font-bold"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {img.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                {newPerk.image && (
                  <div className="mt-3 p-2 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                    <img 
                      src={newPerk.image} 
                      alt="Preview" 
                      className="w-16 h-12 object-cover rounded-lg border border-gray-200" 
                    />
                    <div className="text-xs text-gray-500 truncate flex-1">
                      <span className="font-semibold text-gray-700">Preview:</span> {newPerk.image}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddingPerk(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#ff5a1f] text-white font-bold hover:bg-[#e0480f] text-sm shadow-sm"
                >
                  Create Simulator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingPerk && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#ff5a1f]" />
                <h3 className="text-xl font-bold text-gray-900">Edit VIP Simulator</h3>
              </div>
              <button 
                onClick={() => setEditingPerk(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Simulator Name *
                </label>
                <input 
                  type="text" 
                  value={editingPerk.name}
                  onChange={(e) => setEditingPerk({ ...editingPerk, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={editingPerk.category}
                    onChange={(e) => setEditingPerk({ ...editingPerk, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] bg-white"
                  >
                    <option value="Racing">Racing</option>
                    <option value="Flying">Flying</option>
                    <option value="Gaming & Racing">Gaming &amp; Racing</option>
                    <option value="VR & Flight">VR &amp; Flight</option>
                    <option value="Miniature Sim">Miniature Sim</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Sort Order
                  </label>
                  <input 
                    type="number" 
                    value={editingPerk.sort_order}
                    onChange={(e) => setEditingPerk({ ...editingPerk, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tagline / Description
                </label>
                <input 
                  type="text" 
                  value={editingPerk.tagline}
                  onChange={(e) => setEditingPerk({ ...editingPerk, tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Image Path / URL *
                </label>
                <input 
                  type="text" 
                  value={editingPerk.image}
                  onChange={(e) => setEditingPerk({ ...editingPerk, image: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  required
                />

                {/* Preset quick picker */}
                <div className="mt-2.5">
                  <div className="text-[11px] font-bold text-gray-500 mb-1.5">Quick choose from preset images:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_IMAGES.map((img) => (
                      <button
                        key={img.path}
                        type="button"
                        onClick={() => setEditingPerk({ ...editingPerk, image: img.path })}
                        className={`text-[11px] px-2 py-1 rounded-lg border transition-all ${
                          editingPerk.image === img.path
                            ? "bg-[#ff5a1f]/10 text-[#ff5a1f] border-[#ff5a1f] font-bold"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {img.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                {editingPerk.image && (
                  <div className="mt-3 p-2 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                    <img 
                      src={editingPerk.image} 
                      alt="Preview" 
                      className="w-16 h-12 object-cover rounded-lg border border-gray-200" 
                    />
                    <div className="text-xs text-gray-500 truncate flex-1">
                      <span className="font-semibold text-gray-700">Preview:</span> {editingPerk.image}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingPerk(null)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0d1b2a] text-white font-bold hover:bg-gray-800 text-sm shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmPerk && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Simulator Perk?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to remove <strong className="text-gray-900">&quot;{deleteConfirmPerk.name}&quot;</strong>? It will no longer appear on the customer booking screen.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmPerk(null)}
                className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmPerk.id)}
                className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 text-sm shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
