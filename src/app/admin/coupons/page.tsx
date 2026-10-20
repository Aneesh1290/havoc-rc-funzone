"use client";

import { useState, useEffect, useRef } from "react";
import { Tag, Trash2, Plus, Layers, Calendar, Check, AlertCircle, FileSpreadsheet, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { 
  fetchCouponsAction, 
  createCouponAction, 
  bulkCreateCouponsAction, 
  deleteCouponAction,
  deleteAllCouponsAction,
  deleteMultipleCouponsAction
} from "@/app/actions/tickets";
import { CouponRow } from "@/lib/db";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Single coupon form state
  const [singleCode, setSingleCode] = useState("");
  const [singleType, setSingleType] = useState<"percentage" | "flat">("percentage");
  const [singleValue, setSingleValue] = useState<number>(10);
  const [singleMaxUses, setSingleMaxUses] = useState<string>("");
  const [singleExpiry, setSingleExpiry] = useState<string>("");

  // Bulk coupon form state
  const [bulkPrefix, setBulkPrefix] = useState("BAND-");
  const [bulkCount, setBulkCount] = useState<number>(50);
  const [bulkStartFrom, setBulkStartFrom] = useState<number>(1);
  const [bulkFormat, setBulkFormat] = useState<"sequential" | "random">("sequential");
  const [bulkType, setBulkType] = useState<"percentage" | "flat">("percentage");
  const [bulkValue, setBulkValue] = useState<number>(10);
  const [bulkMaxUses, setBulkMaxUses] = useState<number>(1);

  // Excel Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewCoupons, setPreviewCoupons] = useState<{
    code: string;
    discountType: "percentage" | "flat";
    value: number;
    maxUses: number | null;
    expiryDate?: string | null;
  }[]>([]);
  const [importingExcel, setImportingExcel] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);

  // Loading states
  const [addingSingle, setAddingSingle] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);


  const loadCoupons = async () => {
    try {
      const data = await fetchCouponsAction();
      setCoupons(data);
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleCode.trim()) {
      showNotification("Please enter a coupon code", "error");
      return;
    }
    if (singleValue <= 0) {
      showNotification("Value must be greater than 0", "error");
      return;
    }

    setAddingSingle(true);
    const maxUses = singleMaxUses ? parseInt(singleMaxUses, 10) : null;
    const res = await createCouponAction(singleCode, singleType, Number(singleValue), maxUses, singleExpiry || null);
    setAddingSingle(false);

    if (res.success) {
      showNotification(`Coupon ${singleCode.toUpperCase().trim()} created successfully!`);
      setSingleCode("");
      setSingleMaxUses("");
      setSingleExpiry("");
      loadCoupons();
    } else {
      showNotification(res.error || "Failed to create coupon", "error");
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = Math.min(Math.max(Number(bulkCount) || 1, 1), 500);
    const start = Number(bulkStartFrom) || 1;

    setGeneratingBulk(true);

    const generatedList: { code: string; discountType: "percentage" | "flat"; value: number; maxUses: number | null }[] = [];
    
    for (let i = 0; i < count; i++) {
      let code = "";
      if (bulkFormat === "sequential") {
        const numStr = String(start + i).padStart(count >= 100 ? 3 : 2, "0");
        code = `${bulkPrefix}${numStr}`;
      } else {
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        code = `${bulkPrefix}${randomStr}`;
      }
      generatedList.push({
        code,
        discountType: bulkType,
        value: Number(bulkValue),
        maxUses: bulkMaxUses ? Number(bulkMaxUses) : null,
      });
    }

    const res = await bulkCreateCouponsAction(generatedList);
    setGeneratingBulk(false);

    if (res.success) {
      showNotification(`Generated ${res.count} coupons successfully!`);
      loadCoupons();
    } else {
      showNotification(res.error || "Failed to generate coupons", "error");
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (confirm(`Are you sure you want to delete coupon ${code}?`)) {
      await deleteCouponAction(id);
      showNotification(`Coupon ${code} deleted`);
      loadCoupons();
    }
  };

  const handleClearAll = async () => {
    if (coupons.length === 0) return;
    const count = coupons.length;
    if (confirm(`⚠️ ARE YOU ABSOLUTELY SURE?\n\nThis will permanently delete ALL ${count} coupons from the database. This action cannot be undone.`)) {
      setIsDeletingBulk(true);
      const res = await deleteAllCouponsAction();
      setIsDeletingBulk(false);
      if (res.success) {
        showNotification(`Cleared all ${count} coupons successfully!`);
        loadCoupons();
      } else {
        showNotification(res.error || "Failed to clear coupons", "error");
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (confirm(`Are you sure you want to delete the ${count} selected coupons?`)) {
      setIsDeletingBulk(true);
      const res = await deleteMultipleCouponsAction(selectedIds);
      setIsDeletingBulk(false);
      if (res.success) {
        showNotification(`Deleted ${count} coupons successfully!`);
        loadCoupons();
      } else {
        showNotification(res.error || "Failed to delete selected coupons", "error");
      }
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === coupons.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(coupons.map(c => c.id));
    }
  };

  const handleToggleSelectOne = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Excel Handlers
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Coupon Code": "VIPPASS50",
        "Discount Type": "Percentage",
        "Value": 50,
        "Max Uses": 100,
        "Expiry Date (YYYY-MM-DD)": "2026-12-31"
      },
      {
        "Coupon Code": "FLAT200OFF",
        "Discount Type": "Flat",
        "Value": 200,
        "Max Uses": 1,
        "Expiry Date (YYYY-MM-DD)": ""
      },
      {
        "Coupon Code": "SUMMER10",
        "Discount Type": "Percentage",
        "Value": 10,
        "Max Uses": "",
        "Expiry Date (YYYY-MM-DD)": "2026-11-30"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Coupons");

    // Format column widths
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 16 },
      { wch: 10 },
      { wch: 12 },
      { wch: 25 }
    ];

    XLSX.writeFile(workbook, "havoc_coupons_template.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExcelError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setExcelFile(null);
      setPreviewCoupons([]);
      return;
    }

    setExcelFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setExcelError("The uploaded Excel workbook contains no sheets.");
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          setExcelError("The uploaded sheet is empty.");
          setPreviewCoupons([]);
          return;
        }

        const parsed: {
          code: string;
          discountType: "percentage" | "flat";
          value: number;
          maxUses: number | null;
          expiryDate?: string | null;
        }[] = [];

        for (let i = 0; i < rawJson.length; i++) {
          const row = rawJson[i];
          // Support multiple common header naming conventions
          const rawCode = row["Coupon Code"] ?? row["code"] ?? row["Code"] ?? row["COUPON_CODE"] ?? row["Coupon"] ?? "";
          const code = String(rawCode).trim().toUpperCase();
          if (!code) continue; // skip blank rows

          const rawType = String(row["Discount Type"] ?? row["discount_type"] ?? row["Type"] ?? row["type"] ?? "").toLowerCase();
          const discountType: "percentage" | "flat" = rawType.includes("flat") || rawType.includes("rupee") || rawType.includes("amount") || rawType === "flat"
            ? "flat"
            : "percentage";

          const rawValue = row["Value"] ?? row["value"] ?? row["Discount"] ?? row["discount"] ?? row["Amount"] ?? 10;
          const numValue = Number(rawValue);
          const value = isNaN(numValue) || numValue <= 0 ? 10 : numValue;

          const rawMax = row["Max Uses"] ?? row["max_uses"] ?? row["Uses"] ?? row["Usage"] ?? "";
          let maxUses: number | null = null;
          if (rawMax !== "" && !isNaN(Number(rawMax))) {
            maxUses = Math.max(1, parseInt(String(rawMax), 10));
          }

          let expiryDate: string | null = null;
          const rawExpiry = row["Expiry Date (YYYY-MM-DD)"] ?? row["Expiry Date"] ?? row["expiry_date"] ?? row["Expiry"] ?? "";
          if (rawExpiry) {
            if (rawExpiry instanceof Date) {
              expiryDate = rawExpiry.toISOString().split("T")[0];
            } else {
              const dStr = String(rawExpiry).trim();
              if (dStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                expiryDate = dStr;
              }
            }
          }

          parsed.push({
            code,
            discountType,
            value,
            maxUses,
            expiryDate
          });
        }

        if (parsed.length === 0) {
          setExcelError("No valid coupons could be extracted. Please ensure the column header includes 'Coupon Code'.");
          setPreviewCoupons([]);
          return;
        }

        setPreviewCoupons(parsed);
      } catch (err: any) {
        console.error("Excel parse error:", err);
        setExcelError(err.message || "Failed to parse the Excel file.");
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleImportExcel = async () => {
    if (previewCoupons.length === 0) {
      showNotification("No coupons to import", "error");
      return;
    }

    setImportingExcel(true);
    try {
      const res = await bulkCreateCouponsAction(previewCoupons);
      setImportingExcel(false);

      if (res.success) {
        showNotification(`🎉 Successfully imported ${res.count} coupons from Excel!`);
        setExcelFile(null);
        setPreviewCoupons([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        loadCoupons();
      } else {
        showNotification(res.error || "Failed to import coupons from Excel", "error");
      }
    } catch (e: any) {
      setImportingExcel(false);
      showNotification(e.message || "Failed to process import", "error");
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-heading text-gray-900 tracking-tight">Manage Coupons</h1>
          <p className="text-gray-500 text-sm mt-1">Create individual promo codes or bulk generate ticket discount vouchers.</p>
        </div>
      </div>

      {/* Notification Banner */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 transition-all ${message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {message.type === "success" ? <Check className="w-5 h-5 text-green-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {/* Section 1: Add New Coupon */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Plus className="w-5 h-5 text-[#ff5a1f]" />
          <h2 className="text-lg font-bold text-gray-900">Add New Coupon</h2>
        </div>

        <form onSubmit={handleAddSingle} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Coupon Code</label>
              <input
                type="text"
                required
                value={singleCode}
                onChange={(e) => setSingleCode(e.target.value)}
                placeholder="e.g. SUMMER20"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Discount Type</label>
              <select
                value={singleType}
                onChange={(e) => setSingleType(e.target.value as "percentage" | "flat")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Value</label>
              <input
                type="number"
                required
                min="1"
                value={singleValue}
                onChange={(e) => setSingleValue(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Expiry Date (Optional)</label>
              <input
                type="date"
                value={singleExpiry}
                onChange={(e) => setSingleExpiry(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Max Uses (Optional)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 100"
                value={singleMaxUses}
                onChange={(e) => setSingleMaxUses(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={addingSingle}
                className="w-full sm:w-auto px-8 py-3 bg-[#e0a93b] hover:bg-[#c9942d] text-gray-900 font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {addingSingle ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Section 2: Bulk Create Coupons (Series) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Layers className="w-5 h-5 text-[#ff5a1f]" />
          <h2 className="text-lg font-bold text-gray-900">Bulk Create Coupons (Series)</h2>
        </div>

        <form onSubmit={handleBulkGenerate} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Prefix</label>
              <input
                type="text"
                required
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
                placeholder="e.g. BAND-"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Count (Max 500)</label>
              <input
                type="number"
                min="1"
                max="500"
                required
                value={bulkCount}
                onChange={(e) => setBulkCount(Number(e.target.value))}
                placeholder="e.g. 50"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Start From</label>
              <input
                type="number"
                min="1"
                required
                value={bulkStartFrom}
                onChange={(e) => setBulkStartFrom(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Format</label>
              <select
                value={bulkFormat}
                onChange={(e) => setBulkFormat(e.target.value as "sequential" | "random")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              >
                <option value="sequential">Sequential (1, 2, 3...)</option>
                <option value="random">Random Characters (A9B2, ...)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Discount Type</label>
              <select
                value={bulkType}
                onChange={(e) => setBulkType(e.target.value as "percentage" | "flat")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Value</label>
              <input
                type="number"
                min="1"
                required
                value={bulkValue}
                onChange={(e) => setBulkValue(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Max Uses</label>
              <input
                type="number"
                min="1"
                required
                value={bulkMaxUses}
                onChange={(e) => setBulkMaxUses(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={generatingBulk}
                className="w-full sm:w-auto px-8 py-3 bg-[#e0a93b] hover:bg-[#c9942d] text-gray-900 font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {generatingBulk ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Section 3: Import Coupons from Excel Sheet */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Import Coupons from Excel (.xlsx, .xls, .csv)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Upload a spreadsheet to import hundreds of custom or partner promo codes instantly.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors shadow-2xs self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Download Sample Excel Template
          </button>
        </div>

        {/* Upload Zone */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-2xl p-6 bg-gray-50/60 hover:bg-emerald-50/30 transition-all cursor-pointer group">
              <Upload className="w-8 h-8 text-gray-400 group-hover:text-emerald-600 mb-2 transition-colors" />
              <span className="text-xs font-bold text-gray-700 group-hover:text-emerald-700">
                {excelFile ? excelFile.name : "Click to select or drag and drop your Excel file here"}
              </span>
              <span className="text-[11px] text-gray-400 mt-1">Supports .xlsx, .xls, and .csv files</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="md:col-span-4 flex flex-col justify-center space-y-3">
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] text-gray-600 space-y-1">
              <strong className="block text-gray-800 font-bold">Expected Columns:</strong>
              <div className="font-mono text-[10px] text-gray-500">
                • Coupon Code (Required)<br />
                • Discount Type (Percentage / Flat)<br />
                • Value (e.g. 10, 50, 200)<br />
                • Max Uses (Optional, e.g. 1)<br />
                • Expiry Date (YYYY-MM-DD)
              </div>
            </div>

            {previewCoupons.length > 0 && (
              <button
                type="button"
                disabled={importingExcel}
                onClick={handleImportExcel}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {importingExcel ? "Importing to Database..." : `Import ${previewCoupons.length} Coupons Now`}
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {excelError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{excelError}</span>
          </div>
        )}

        {/* Live Preview Table */}
        {previewCoupons.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Excel Preview ({previewCoupons.length} coupons detected, showing first 5)
              </span>
              <button
                type="button"
                onClick={() => {
                  setExcelFile(null);
                  setPreviewCoupons([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-xs text-red-600 hover:underline font-semibold"
              >
                Cancel / Clear
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Value</th>
                    <th className="px-4 py-2.5">Max Uses</th>
                    <th className="px-4 py-2.5">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                  {previewCoupons.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-2 font-mono font-bold text-gray-900">{row.code}</td>
                      <td className="px-4 py-2 capitalize">{row.discountType}</td>
                      <td className="px-4 py-2 font-bold text-emerald-600">
                        {row.discountType === "percentage" ? `${row.value}%` : `₹${row.value}`}
                      </td>
                      <td className="px-4 py-2">{row.maxUses ?? "Unlimited"}</td>
                      <td className="px-4 py-2 text-gray-500">{row.expiryDate || "Never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewCoupons.length > 5 && (
                <div className="p-2.5 bg-gray-50/70 border-t border-gray-100 text-center text-xs text-gray-500 font-semibold">
                  + {previewCoupons.length - 5} more coupons will be imported into the database
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Active Coupons Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#ff5a1f]" />
            <h2 className="text-lg font-bold text-gray-900">Active Coupons ({coupons.length})</h2>
          </div>

          {coupons.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  disabled={isDeletingBulk}
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedIds.length})
                </button>
              )}
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeletingBulk ? "Clearing..." : "Clear All Coupons"}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading coupons...</div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-500">No coupons created yet</p>
            <p className="text-xs text-gray-400 mt-1">Add a coupon above or generate a batch series.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-4 px-4 w-10 text-center">
                    <input 
                      type="checkbox"
                      checked={coupons.length > 0 && selectedIds.length === coupons.length}
                      onChange={handleToggleSelectAll}
                      className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] cursor-pointer"
                      title="Select all coupons"
                    />
                  </th>
                  <th className="py-4 px-6">Code</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Value</th>
                  <th className="py-4 px-6">Uses</th>
                  <th className="py-4 px-6">Expires</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {coupons.map((coupon) => (
                  <tr 
                    key={coupon.id} 
                    className={`hover:bg-gray-50/70 transition-colors ${selectedIds.includes(coupon.id) ? "bg-orange-50/40" : ""}`}
                  >
                    <td className="py-4 px-4 text-center">
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(coupon.id)}
                        onChange={() => handleToggleSelectOne(coupon.id)}
                        className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-gray-900">
                      <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md text-xs">
                        {coupon.code}
                      </span>
                    </td>
                    <td className="py-4 px-6 capitalize text-gray-600">
                      {coupon.discount_type === "percentage" ? "Percentage" : "Flat Amount"}
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-900">
                      {coupon.discount_type === "percentage" ? `${coupon.value}%` : `₹${coupon.value}`}
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      <span className="font-medium text-gray-900">{coupon.used_count}</span>
                      <span className="text-gray-400"> / {coupon.max_uses !== null ? coupon.max_uses : "∞"}</span>
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      {coupon.expiry_date ? coupon.expiry_date : "Never"}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDelete(coupon.id, coupon.code)}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete coupon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
