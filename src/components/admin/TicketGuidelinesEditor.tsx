"use client";

import { useState, useEffect } from "react";
import { 
  DEFAULT_TICKET_GUIDELINES, 
  type TicketGuidelinesConfig, 
  type TicketGuidelineItem 
} from "@/lib/ticket-guidelines";
import { 
  fetchTicketGuidelinesAction, 
  saveTicketGuidelinesAction, 
  resetTicketGuidelinesAction 
} from "@/app/actions/tickets";
import { 
  AlertTriangle, 
  Save, 
  RotateCcw, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  EyeOff, 
  Check, 
  Loader2,
  HelpCircle,
  FileText
} from "lucide-react";

export default function TicketGuidelinesEditor() {
  const [config, setConfig] = useState<TicketGuidelinesConfig>(DEFAULT_TICKET_GUIDELINES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchTicketGuidelinesAction();
        if (data && Array.isArray(data.items)) {
          setConfig(data);
        }
      } catch (err: any) {
        console.error("Failed to load guidelines:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await saveTicketGuidelinesAction(config);
      if (res.success) {
        setFeedback({
          type: "success",
          message: "Important Guidelines updated and published successfully! Live pages refreshed."
        });
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to save guidelines."
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred while saving."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to restore the official default guidelines? Any unsaved edits will be lost.")) return;
    setIsResetting(true);
    setFeedback(null);
    try {
      const res = await resetTicketGuidelinesAction();
      if (res.success && res.config) {
        setConfig(res.config);
        setFeedback({
          type: "success",
          message: "Guidelines reset to official defaults!"
        });
        setTimeout(() => setFeedback(null), 5000);
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to reset guidelines."
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to reset guidelines."
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleAddItem = () => {
    const newItem: TicketGuidelineItem = {
      id: `g-${Date.now()}`,
      title: "",
      text: "",
      highlight: ""
    };
    setConfig(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleItemChange = (index: number, field: keyof TicketGuidelineItem, value: string) => {
    setConfig(prev => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return { ...prev, items: updated };
    });
  };

  const handleDeleteItem = (index: number) => {
    if (!confirm(`Delete guideline item #${index + 1}?`)) return;
    setConfig(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setConfig(prev => {
      const items = [...prev.items];
      const temp = items[index - 1];
      items[index - 1] = items[index];
      items[index] = temp;
      return { ...prev, items };
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === config.items.length - 1) return;
    setConfig(prev => {
      const items = [...prev.items];
      const temp = items[index + 1];
      items[index + 1] = items[index];
      items[index] = temp;
      return { ...prev, items };
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#ff5a1f]" />
        <span>Loading Guidelines Configuration...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-50 text-[#ff5a1f] border border-orange-200">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-xl font-black font-heading text-gray-900">
                Important Guidelines Editor
              </h3>
              <p className="text-xs text-gray-500">
                Manage the public terms, pricing notices, and venue guidelines displayed on <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">/tickets</code> and month booking pages.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5 text-gray-500" /> : <Eye className="w-3.5 h-3.5 text-[#ff5a1f]" />}
            <span>{showPreview ? "Hide Preview" : "Live Preview"}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting || isSaving}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Reset back to default guidelines"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-[#ff5a1f] hover:bg-[#e04810] text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? "Publishing..." : "Save Guidelines"}</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold animate-in fade-in ${
          feedback.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {feedback.type === "success" ? <Check className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Live Customer Preview */}
      {showPreview && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-white border-2 border-dashed border-orange-300 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-[#ff5a1f] flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> Customer Live Preview
            </span>
            <span className="text-[11px] text-gray-500">Matches public /tickets page</span>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <h2 className="text-xl font-black font-heading text-[#0d1b2a] mb-6 flex items-center gap-2">
              {config.sectionTitle || "⚠️ Important Guidelines:"}
            </h2>

            <ul className="space-y-4 text-gray-800 text-xs sm:text-sm font-bold leading-relaxed">
              {config.items.map((item, index) => (
                <li key={item.id || index} className="flex gap-3">
                  <span className="min-w-[20px] text-[#ff5a1f] font-black">{index + 1}.</span>
                  <div className="flex-1 space-y-0.5">
                    <div>
                      {item.title && item.title.trim() && (
                        <span className="underline decoration-2 underline-offset-4 text-[#0d1b2a] mr-1.5">
                          {item.title}
                        </span>
                      )}
                      <span>{item.text}</span>
                    </div>
                    {item.highlight && item.highlight.trim() && (
                      <div className="text-[#ff5a1f] font-bold text-xs">
                        {item.highlight}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Section Title Config */}
      <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-1.5">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
          Section Title (as shown on public page)
        </label>
        <input
          type="text"
          value={config.sectionTitle}
          onChange={(e) => setConfig({ ...config, sectionTitle: e.target.value })}
          placeholder="e.g. ⚠️ Important Guidelines:"
          className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
        />
      </div>

      {/* Guideline Items List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-gray-900">
            Guideline Items ({config.items.length})
          </h4>
          <button
            type="button"
            onClick={handleAddItem}
            className="px-3 py-1.5 bg-[#0d1b2a] hover:bg-gray-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Guideline</span>
          </button>
        </div>

        <div className="space-y-3">
          {config.items.map((item, index) => (
            <div
              key={item.id || index}
              className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all p-4 shadow-2xs space-y-3 group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-[#ff5a1f] font-black text-xs flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-xs font-bold text-gray-500">
                    Rule #{index + 1}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === config.items.length - 1}
                    className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-20 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(index)}
                    className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer ml-1"
                    title="Delete Guideline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Prefix / Title */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                    Label / Pass Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={item.title || ""}
                    onChange={(e) => handleItemChange(index, "title", e.target.value)}
                    placeholder="e.g. Visitor Ticket: or Note:"
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#ff5a1f]"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Rendered underlined before rule text</p>
                </div>

                {/* Highlight / Pricing note */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                    Highlighted Subtext / Pricing (Optional)
                  </label>
                  <input
                    type="text"
                    value={item.highlight || ""}
                    onChange={(e) => handleItemChange(index, "highlight", e.target.value)}
                    placeholder="e.g. ₹300 + GST per hour per person or ❌ No entry without ticket"
                    className="w-full bg-gray-50/50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-[#ff5a1f] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#ff5a1f]"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">Rendered in bold orange font below the rule</p>
                </div>
              </div>

              {/* Main Rule Text */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                  Guideline Description &amp; Terms *
                </label>
                <textarea
                  rows={2}
                  value={item.text}
                  onChange={(e) => handleItemChange(index, "text", e.target.value)}
                  placeholder="Enter the guideline details here..."
                  className="w-full bg-gray-50/50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 font-medium leading-relaxed focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#ff5a1f]"
                />
              </div>
            </div>
          ))}
        </div>

        {config.items.length === 0 && (
          <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl space-y-2">
            <p className="text-xs text-gray-500 font-bold">No guidelines listed.</p>
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-1.5 text-xs font-bold text-[#ff5a1f] bg-orange-50 hover:bg-orange-100 rounded-lg cursor-pointer"
            >
              Restore Official Defaults
            </button>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAddItem}
            className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4 text-[#ff5a1f]" />
            <span>Add Another Guideline Item</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 text-xs font-bold rounded-xl bg-[#ff5a1f] hover:bg-[#e04810] text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? "Publishing..." : "Save & Publish Guidelines"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

