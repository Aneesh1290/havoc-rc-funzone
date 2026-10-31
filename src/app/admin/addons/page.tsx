"use client";

import { useState, useEffect } from "react";
import { PackagePlus, X, Trash2, Plus, Edit2, Check, Power, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { 
  fetchAddonsAction, 
  createAddonAction, 
  updateAddonAction, 
  toggleAddonStatusAction, 
  deleteAddonAction,
  fetchAddonExclusionNoticeAction,
  saveAddonExclusionNoticeAction
} from "@/app/actions/addons";
import type { AddonRow } from "@/lib/db";

export default function AdminAddonsPage() {
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingAddon, setEditingAddon] = useState<AddonRow | null>(null);
  const [deleteConfirmAddon, setDeleteConfirmAddon] = useState<AddonRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pass comparison table notice wording
  const [exclusionNotice, setExclusionNotice] = useState("*Excavator Activity is not included in the package. It can be purchased separately as an add-on.");
  const [isSavingNotice, setIsSavingNotice] = useState(false);
  const [noticeSavedMsg, setNoticeSavedMsg] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    price: 300,
    tagline: "",
    benefits: "1-Hour arena session",
    description: "",
    sortOrder: 1
  });

  const loadAddons = async () => {
    setIsLoading(true);
    try {
      const [addonsData, noticeData] = await Promise.all([
        fetchAddonsAction(false),
        fetchAddonExclusionNoticeAction()
      ]);
      setAddons(addonsData);
      if (noticeData) setExclusionNotice(noticeData);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load add-ons.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAddons();
  }, []);

  const handleSaveNotice = async () => {
    setIsSavingNotice(true);
    try {
      const res = await saveAddonExclusionNoticeAction(exclusionNotice);
      if (res.success) {
        setNoticeSavedMsg(true);
        setTimeout(() => setNoticeSavedMsg(false), 3000);
      } else {
        setErrorMsg(res.error || "Failed to save notice wording");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save notice wording");
    } finally {
      setIsSavingNotice(false);
    }
  };

  const handleToggle = async (id: number, currentActive: number) => {
    setAddons(addons.map(a => a.id === id ? { ...a, active: currentActive ? 0 : 1 } : a));
    await toggleAddonStatusAction(id, currentActive !== 1);
    await loadAddons();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg("Add-on name is required.");
      return;
    }
    if (formData.price < 0) {
      setErrorMsg("Price cannot be negative.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await createAddonAction({
        name: formData.name.trim(),
        price: Number(formData.price),
        tagline: formData.tagline.trim(),
        benefits: formData.benefits.trim(),
        description: formData.description.trim(),
        sort_order: Number(formData.sortOrder) || 1
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to create add-on");
      } else {
        setIsAdding(false);
        setFormData({ name: "", price: 300, tagline: "", benefits: "1-Hour arena session", description: "", sortOrder: 1 });
        await loadAddons();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddon) return;
    if (!editingAddon.name.trim()) {
      setErrorMsg("Add-on name is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await updateAddonAction(editingAddon.id, {
        name: editingAddon.name.trim(),
        price: Number(editingAddon.price),
        tagline: editingAddon.tagline || "",
        benefits: editingAddon.benefits || "",
        description: editingAddon.description || "",
        sort_order: Number(editingAddon.sort_order) || 1
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to update add-on");
      } else {
        setEditingAddon(null);
        await loadAddons();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsSubmitting(true);
    try {
      const res = await deleteAddonAction(id);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to delete add-on");
      } else {
        setDeleteConfirmAddon(null);
        await loadAddons();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete add-on");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCount = addons.filter(a => a.active === 1).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#ff5a1f] flex items-center justify-center shadow-sm border border-orange-100">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0d1b2a] font-heading tracking-tight">
                Activity Add-ons
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage extra activities (e.g. Excavator activity) that customers can opt-in to add to their booking.
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => {
            setErrorMsg(null);
            setIsAdding(true);
          }}
          className="inline-flex items-center justify-center gap-2 bg-[#ff5a1f] hover:bg-[#e04812] text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md shadow-[#ff5a1f]/20 hover:-translate-y-0.5 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Add-on</span>
        </button>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-red-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Add-ons</p>
            <p className="text-3xl font-black text-[#0d1b2a] mt-1">{addons.length}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600">
            <PackagePlus className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active in Checkout</p>
            <p className="text-3xl font-black text-green-600 mt-1">{activeCount}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Pass Comparison Notice / Exclusion Wording Card */}
      <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <span className="text-[#ff5a1f]">📢</span> Pass Comparison Table Notice (Participant &amp; VIP passes)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Edit the red notification text displayed under Participant passes informing customers that this activity is an extra add-on.
            </p>
          </div>
          {noticeSavedMsg && (
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200 flex items-center gap-1 animate-in fade-in">
              <Check className="w-3.5 h-3.5" /> Saved Live!
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="text"
            value={exclusionNotice}
            onChange={(e) => setExclusionNotice(e.target.value)}
            placeholder="e.g. *Excavator Activity is not included in the package. It can be purchased separately as an add-on."
            className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
          />
          <button
            type="button"
            onClick={handleSaveNotice}
            disabled={isSavingNotice}
            className="px-5 py-2.5 bg-[#0d1b2a] hover:bg-[#ff5a1f] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
          >
            {isSavingNotice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Update Notice Wording</span>
          </button>
        </div>
      </div>

      {/* Add-ons List */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff5a1f]" />
          <p className="text-sm font-semibold text-gray-600">Loading add-ons...</p>
        </div>
      ) : addons.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-gray-300 space-y-3">
          <PackagePlus className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-900">No add-ons created yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Create your first add-on (like RC Excavator Activity) to offer it as an extra during booking.
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ff5a1f] hover:underline pt-1"
          >
            + Create New Add-on
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {addons.map((addon) => {
            const isActive = addon.active === 1;

            return (
              <div 
                key={addon.id}
                className={`p-6 rounded-2xl bg-white border transition-all duration-200 shadow-sm relative flex flex-col justify-between ${
                  isActive ? "border-gray-200 hover:border-orange-200 hover:shadow-md" : "border-gray-200 bg-gray-50/60 opacity-80"
                }`}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl">🚜</span>
                        <h3 className="text-lg font-black text-gray-900 font-heading">
                          {addon.name}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          isActive 
                            ? "bg-green-50 text-green-700 border-green-200" 
                            : "bg-gray-100 text-gray-500 border-gray-200"
                        }`}>
                          {isActive ? "Active" : "Disabled"}
                        </span>
                      </div>
                      {addon.tagline && (
                        <p className="text-xs font-medium text-gray-600 mt-1">
                          {addon.tagline}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xl font-black text-[#ff5a1f]">
                        ₹{addon.price}
                      </span>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">per person</p>
                    </div>
                  </div>

                  {/* Access & Benefits Wording (Comparison Table & Booking bullets) */}
                  {addon.benefits && (
                    <div className="my-2.5 p-2.5 rounded-xl bg-blue-50/60 border border-blue-100/80 space-y-1">
                      <p className="text-[10px] font-bold text-[#0040c0] uppercase tracking-wider">
                        Table Benefits Wording:
                      </p>
                      {addon.benefits.split("\n").map(s => s.trim()).filter(Boolean).map((bullet, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs font-semibold text-gray-900">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#0040c0] text-white flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
                          <span>• {bullet}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {addon.description && (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600 leading-relaxed my-3">
                      {addon.description}
                    </div>
                  )}

                  <div className="text-[11px] text-gray-400 mt-2 flex items-center gap-3">
                    <span>Sort Order: #{addon.sort_order}</span>
                    <span>•</span>
                    <span>Linked Ticket ID: #{addon.ticket_id || "N/A"}</span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                  <button
                    onClick={() => handleToggle(addon.id, addon.active)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isActive 
                        ? "bg-gray-100 hover:bg-gray-200 text-gray-700" 
                        : "bg-green-50 hover:bg-green-100 text-green-700"
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{isActive ? "Disable" : "Enable"}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingAddon(addon)}
                      className="p-2 text-gray-500 hover:text-[#ff5a1f] hover:bg-orange-50 rounded-lg transition-colors"
                      title="Edit add-on"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmAddon(addon)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete add-on"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Add-on Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#ff5a1f] flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 font-heading">
                    Add New Activity Add-on
                  </h3>
                  <p className="text-xs text-gray-500">Configure details for the booking add-on.</p>
                </div>
              </div>
              <button onClick={() => setIsAdding(false)} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Add-on Name *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. RC Excavator Activity"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Price (₹) *
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Sort Order
                  </label>
                  <input 
                    type="number"
                    min="1"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Short Tagline / Heading
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Operate realistic hydraulic RC excavators in the mining quarry zone"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Access &amp; Benefits Wording (Table Bullets)
                  </label>
                  <span className="text-[10px] text-gray-400">One bullet per line</span>
                </div>
                <textarea 
                  rows={2}
                  placeholder="e.g.&#10;1-Hour arena session"
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                  className="w-full p-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Each line appears with a blue checkmark on the Pass Comparison Table.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Full Description (Optional)
                </label>
                <textarea 
                  rows={3}
                  placeholder="Briefly describe what is included with this add-on..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#ff5a1f] hover:bg-[#e04812] text-white shadow-md shadow-[#ff5a1f]/20 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Add-on</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Add-on Modal */}
      {editingAddon && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#ff5a1f] flex items-center justify-center font-bold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 font-heading">
                    Edit Add-on: {editingAddon.name}
                  </h3>
                  <p className="text-xs text-gray-500">Update pricing or descriptions.</p>
                </div>
              </div>
              <button onClick={() => setEditingAddon(null)} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Add-on Name *
                </label>
                <input 
                  type="text"
                  required
                  value={editingAddon.name}
                  onChange={(e) => setEditingAddon({ ...editingAddon, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Price (₹) *
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={editingAddon.price}
                    onChange={(e) => setEditingAddon({ ...editingAddon, price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Sort Order
                  </label>
                  <input 
                    type="number"
                    min="1"
                    value={editingAddon.sort_order}
                    onChange={(e) => setEditingAddon({ ...editingAddon, sort_order: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Short Tagline / Heading
                </label>
                <input 
                  type="text"
                  value={editingAddon.tagline || ""}
                  onChange={(e) => setEditingAddon({ ...editingAddon, tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Access &amp; Benefits Wording (Table Bullets)
                  </label>
                  <span className="text-[10px] text-gray-400">One bullet per line</span>
                </div>
                <textarea 
                  rows={2}
                  placeholder="e.g.&#10;1-Hour arena session"
                  value={editingAddon.benefits || ""}
                  onChange={(e) => setEditingAddon({ ...editingAddon, benefits: e.target.value })}
                  className="w-full p-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Each line appears with a blue checkmark on the Pass Comparison Table.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Full Description
                </label>
                <textarea 
                  rows={3}
                  value={editingAddon.description || ""}
                  onChange={(e) => setEditingAddon({ ...editingAddon, description: e.target.value })}
                  className="w-full p-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingAddon(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-[#ff5a1f] hover:bg-[#e04812] text-white shadow-md shadow-[#ff5a1f]/20 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmAddon && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-heading">Delete Add-on?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete <span className="font-bold text-gray-900">{deleteConfirmAddon.name}</span>? This will remove it from future customer booking options.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmAddon(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDelete(deleteConfirmAddon.id)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
