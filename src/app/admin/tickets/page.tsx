"use client";

import { useState, useEffect } from "react";
import { Ticket, X, Trash2, Plus, Sparkles, Clock, Edit2 } from "lucide-react";
import { 
  fetchTicketsAction, 
  toggleTicketStatusAction, 
  updateTicketAction, 
  createTicketAction, 
  deleteTicketAction 
} from "@/app/actions/tickets";
import type { TicketRow } from "@/lib/db";

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTicket, setEditingTicket] = useState<TicketRow | null>(null);
  const [isAddingTicket, setIsAddingTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({ 
    name: "", 
    price: 1500, 
    capacity: 20,
    hasSimulatorPerk: false,
    perkDurationMins: 60,
    perkTitle: "1-Hour Havoc Sim Podium Session",
    description: "",
    benefits: ""
  });
  const [deleteConfirmTicket, setDeleteConfirmTicket] = useState<TicketRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadTickets = async () => {
    setIsLoading(true);
    const data = await fetchTicketsAction();
    setTickets(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const toggleStatus = async (id: number, currentActive: boolean) => {
    // Optimistic update
    setTickets(tickets.map(t => t.id === id ? { ...t, active: currentActive ? 0 : 1 } : t));
    await toggleTicketStatusAction(id, !currentActive);
    await loadTickets();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTicket) {
      setTickets(tickets.map(t => t.id === editingTicket.id ? editingTicket : t));
      const target = editingTicket;
      setEditingTicket(null);
      await updateTicketAction(
        target.id, 
        target.price, 
        target.capacity,
        Boolean(target.has_simulator_perk),
        target.perk_duration_mins || 30,
        target.perk_title || "",
        target.description || "",
        target.benefits || ""
      );
      await loadTickets();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.name.trim()) return;

    setErrorMsg(null);
    const res = await createTicketAction(
      newTicket.name, 
      newTicket.price, 
      newTicket.capacity,
      newTicket.hasSimulatorPerk,
      newTicket.perkDurationMins,
      newTicket.perkTitle,
      newTicket.description,
      newTicket.benefits
    );
    if (res.success) {
      setIsAddingTicket(false);
      setNewTicket({ 
        name: "", 
        price: 1500, 
        capacity: 20,
        hasSimulatorPerk: false,
        perkDurationMins: 60,
        perkTitle: "1-Hour Havoc Sim Podium Session",
        description: "",
        benefits: ""
      });
      await loadTickets();
    } else {
      setErrorMsg(res.error || "Failed to create ticket");
    }
  };

  const handleDelete = async (id: number) => {
    setErrorMsg(null);
    const res = await deleteTicketAction(id);
    if (res.success) {
      setDeleteConfirmTicket(null);
      await loadTickets();
    } else {
      setErrorMsg(res.error || "Failed to delete ticket. It might have active bookings associated with it.");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500 font-medium">Loading ticket types...</div>;
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-black text-gray-900">Ticket Types &amp; Passes</h1>
          <p className="text-gray-500 mt-1">
            Configure pass pricing, capacity, and VIP simulator perks (e.g. 30-min or 1-hour free simulator).
          </p>
        </div>
        <button 
          onClick={() => {
            setErrorMsg(null);
            setIsAddingTicket(true);
          }}
          className="bg-[#0d1b2a] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Pass / Ticket</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wider font-bold bg-gray-50/50">
                <th className="py-3.5 px-4">Ticket / Pass Name</th>
                <th className="py-3.5 px-4">Price</th>
                <th className="py-3.5 px-4">Capacity (per slot)</th>
                <th className="py-3.5 px-4">Simulator Perk</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {tickets.map((ticket) => {
                const hasPerk = Boolean(ticket.has_simulator_perk);
                const duration = ticket.perk_duration_mins || 30;

                return (
                  <tr key={ticket.id} className={`hover:bg-gray-50/60 transition-colors ${ticket.active === 0 ? 'opacity-60' : ''}`}>
                    <td className="py-4 px-4 font-bold text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          hasPerk 
                            ? 'bg-orange-50 text-[#ff5a1f] border border-[#ff5a1f]/20' 
                            : ticket.active === 1 
                              ? 'bg-blue-50 text-blue-600' 
                              : 'bg-gray-100 text-gray-400'
                        }`}>
                          {hasPerk ? <Sparkles className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                            <span>{ticket.name.replace(/_/g, ' ')}</span>
                            {hasPerk && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-100 text-[#ff5a1f] border border-[#ff5a1f]/30">
                                VIP SIM PERK
                              </span>
                            )}
                          </div>
                          {ticket.perk_title && (
                            <div className="text-[11px] text-gray-500 font-medium">
                              {ticket.perk_title}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-bold text-gray-900">₹{ticket.price}</td>
                    <td className="py-4 px-4 text-gray-600 font-medium">{ticket.capacity} / slot</td>
                    <td className="py-4 px-4">
                      {hasPerk ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>{duration} Mins Free Sim</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">No Simulator Perk</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={() => toggleStatus(ticket.id, ticket.active === 1)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          ticket.active === 1
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${ticket.active === 1 ? "bg-emerald-500" : "bg-gray-400"}`}></span>
                        {ticket.active === 1 ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button 
                          onClick={() => setEditingTicket(ticket)}
                          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit ticket"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmTicket(ticket)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete ticket"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Ticket Modal */}
      {editingTicket && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#ff5a1f]" />
                <h2 className="text-xl font-black font-heading text-gray-900">Edit {editingTicket.name.replace(/_/g, ' ')}</h2>
              </div>
              <button onClick={() => setEditingTicket(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Price (₹) *</label>
                  <input 
                    type="number" 
                    value={editingTicket.price}
                    onChange={(e) => setEditingTicket({...editingTicket, price: parseInt(e.target.value) || 0})}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] outline-none text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Capacity (per slot) *</label>
                  <input 
                    type="number" 
                    value={editingTicket.capacity}
                    onChange={(e) => setEditingTicket({...editingTicket, capacity: parseInt(e.target.value) || 0})}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] outline-none text-sm"
                    required
                  />
                </div>
              </div>

              {/* VIP Simulator Perk Toggle Box */}
              <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/40 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={Boolean(editingTicket.has_simulator_perk)}
                    onChange={(e) => setEditingTicket({
                      ...editingTicket, 
                      has_simulator_perk: e.target.checked ? 1 : 0 
                    })}
                    className="w-4 h-4 text-[#ff5a1f] rounded focus:ring-[#ff5a1f]"
                  />
                  <div>
                    <span className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#ff5a1f]" />
                      Enable Free VIP Simulator Perk
                    </span>
                    <p className="text-xs text-gray-500">
                      Customers purchasing this pass will be prompted to select a simulator &amp; slot.
                    </p>
                  </div>
                </label>

                {Boolean(editingTicket.has_simulator_perk) && (
                  <div className="pt-3 border-t border-orange-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Simulator Session Duration
                      </label>
                      <select
                        value={editingTicket.perk_duration_mins || 30}
                        onChange={(e) => setEditingTicket({
                          ...editingTicket,
                          perk_duration_mins: parseInt(e.target.value) || 30
                        })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={60}>1 Hour (60 Mins)</option>
                        <option value={90}>1.5 Hours (90 Mins)</option>
                        <option value={120}>2 Hours (120 Mins)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Perk Display Title
                      </label>
                      <input 
                        type="text"
                        value={editingTicket.perk_title || ""}
                        onChange={(e) => setEditingTicket({
                          ...editingTicket,
                          perk_title: e.target.value
                        })}
                        placeholder="e.g. 1-Hour Havoc Sim Session"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tagline / Short Summary
                </label>
                <input 
                  type="text" 
                  value={editingTicket.description || ""}
                  onChange={(e) => setEditingTicket({...editingTicket, description: e.target.value})}
                  placeholder="e.g. 15 RC activities + 1-Hour Free Simulator session (Excavator extra)."
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Benefits (One per line)
                </label>
                <textarea 
                  rows={3}
                  value={editingTicket.benefits || ""}
                  onChange={(e) => setEditingTicket({...editingTicket, benefits: e.target.value})}
                  placeholder="Full play access to 15 RC activities&#10;Excavator activity is paid extra&#10;Upgraded hobby grade RC cars&#10;Free 1-Hour simulator session"
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs leading-relaxed focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setEditingTicket(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-[#ff5a1f] hover:bg-[#e04812] text-white font-bold py-2.5 rounded-xl transition-colors shadow-sm text-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Ticket Modal */}
      {isAddingTicket && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#ff5a1f]" />
                <h2 className="text-xl font-black font-heading text-gray-900">Create New Pass Type</h2>
              </div>
              <button onClick={() => setIsAddingTicket(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Pass Name (e.g. VVIP PARTICIPANT) *
                </label>
                <input 
                  type="text" 
                  value={newTicket.name}
                  onChange={(e) => setNewTicket({...newTicket, name: e.target.value})}
                  placeholder="e.g. VVIP PARTICIPANT"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold uppercase focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] outline-none text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Price (₹) *</label>
                  <input 
                    type="number" 
                    value={newTicket.price}
                    onChange={(e) => setNewTicket({...newTicket, price: parseInt(e.target.value) || 0})}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] outline-none text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Capacity (per slot) *</label>
                  <input 
                    type="number" 
                    value={newTicket.capacity}
                    onChange={(e) => setNewTicket({...newTicket, capacity: parseInt(e.target.value) || 0})}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] outline-none text-sm"
                    required
                  />
                </div>
              </div>

              {/* VIP Simulator Perk Toggle Box */}
              <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/40 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={newTicket.hasSimulatorPerk}
                    onChange={(e) => setNewTicket({...newTicket, hasSimulatorPerk: e.target.checked})}
                    className="w-4 h-4 text-[#ff5a1f] rounded focus:ring-[#ff5a1f]"
                  />
                  <div>
                    <span className="text-sm font-black text-gray-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#ff5a1f]" />
                      Include Free Simulator Perk
                    </span>
                    <p className="text-xs text-gray-500">
                      Enable this if this pass allows customers to pick a simulator (e.g. 1 hour on any sim).
                    </p>
                  </div>
                </label>

                {newTicket.hasSimulatorPerk && (
                  <div className="pt-3 border-t border-orange-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Simulator Session Duration
                      </label>
                      <select
                        value={newTicket.perkDurationMins}
                        onChange={(e) => setNewTicket({
                          ...newTicket,
                          perkDurationMins: parseInt(e.target.value) || 60
                        })}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={60}>1 Hour (60 Mins)</option>
                        <option value={90}>1.5 Hours (90 Mins)</option>
                        <option value={120}>2 Hours (120 Mins)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Perk Display Title
                      </label>
                      <input 
                        type="text"
                        value={newTicket.perkTitle}
                        onChange={(e) => setNewTicket({
                          ...newTicket,
                          perkTitle: e.target.value
                        })}
                        placeholder="e.g. 1-Hour Havoc Sim Podium Session"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tagline / Short Summary
                </label>
                <input 
                  type="text" 
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                  placeholder="e.g. 15 RC activities + 1 hour session on any simulator (Excavator extra)."
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Benefits (One per line)
                </label>
                <textarea 
                  rows={3}
                  value={newTicket.benefits}
                  onChange={(e) => setNewTicket({...newTicket, benefits: e.target.value})}
                  placeholder="Full 1-Hour access to 15 RC activities&#10;Excavator activity is paid extra&#10;Upgraded hobby grade RC cars&#10;FREE 1-Hour session on any Havoc Sim Podium simulator"
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs leading-relaxed focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsAddingTicket(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-[#0d1b2a] hover:bg-gray-800 text-white font-bold py-2.5 rounded-xl transition-colors shadow-sm text-sm"
                >
                  Create Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTicket && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Ticket Type?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to remove <strong className="text-gray-900">&quot;{deleteConfirmTicket.name}&quot;</strong>? This cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmTicket(null)}
                className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmTicket.id)}
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
