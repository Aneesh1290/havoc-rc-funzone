"use client";

import { useState, useEffect } from "react";
import { 
  CreditCard, 
  KeyRound, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Loader2, 
  ToggleLeft, 
  ToggleRight,
  Layers,
  Building2,
  Server
} from "lucide-react";
import { changePasswordAction } from "@/app/login/actions";
import { 
  getAdminPaymentSettingsAction, 
  updateAdminPaymentSettingsAction, 
  AdminPaymentSettings, 
  GatewayProvider, 
  GatewayEnvironment,
  DefaultPaymentMethod
} from "@/app/actions/payment-settings";

export default function SettingsPage() {
  // Password state
  const [passwordState, setPasswordState] = useState<{
    isLoading: boolean;
    error: string | null;
    success: string | null;
  }>({
    isLoading: false,
    error: null,
    success: null,
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Payment Settings State
  const [isPaymentLoading, setIsPaymentLoading] = useState(true);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);
  const [paymentErrorMsg, setPaymentErrorMsg] = useState<string | null>(null);

  const [paymentSettings, setPaymentSettings] = useState<AdminPaymentSettings>({
    enableOnline: true,
    enableDesk: true,
    defaultMethod: "online",
    activeGateway: "icici",
    gatewayEnv: "live",
    icici: {
      merchantId: "100000000531583",
      aggregatorId: "100000000531582",
      secretKey: "9927ca2f-17bd-401d-8ae4-c34f5ea641bc",
    },
    razorpay: {
      keyId: "",
      keySecret: "",
    },
    phonepe: {
      merchantId: "",
      saltKey: "",
      saltIndex: "1",
    },
    cashfree: {
      appId: "",
      secretKey: "",
    },
  });

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadPaymentSettings() {
      try {
        setIsPaymentLoading(true);
        const data = await getAdminPaymentSettingsAction();
        setPaymentSettings(data);
      } catch (err: any) {
        console.error("Failed to load payment settings:", err);
      } finally {
        setIsPaymentLoading(false);
      }
    }
    loadPaymentSettings();
  }, []);

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPaymentSaving(true);
    setPaymentSuccessMsg(null);
    setPaymentErrorMsg(null);

    try {
      const res = await updateAdminPaymentSettingsAction(paymentSettings);
      if (res.success) {
        setPaymentSuccessMsg("Payment gateway settings saved successfully! Changes are live immediately.");
        setTimeout(() => setPaymentSuccessMsg(null), 5000);
      } else {
        setPaymentErrorMsg(res.error || "Failed to update payment settings");
      }
    } catch (err: any) {
      setPaymentErrorMsg(err.message || "Failed to update payment settings");
    } finally {
      setIsPaymentSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordState({ isLoading: true, error: null, success: null });

    const formData = new FormData();
    formData.append("currentPassword", currentPassword);
    formData.append("newPassword", newPassword);
    formData.append("confirmPassword", confirmPassword);

    try {
      const res = await changePasswordAction(formData);
      if (res?.error) {
        setPasswordState({ isLoading: false, error: res.error, success: null });
      } else {
        setPasswordState({
          isLoading: false,
          error: null,
          success: "Password successfully updated and securely hashed!",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setPasswordState({
        isLoading: false,
        error: "Failed to update password. Please try again.",
        success: null,
      });
    }
  };

  const GATEWAY_CARDS: {
    id: GatewayProvider;
    title: string;
    description: string;
    badge: string;
    badgeColor: string;
  }[] = [
    {
      id: "icici",
      title: "ICICI Bank (Direct PG)",
      description: "Direct bank gateway with corporate UPI & EPG. Instant slot lock & verification.",
      badge: "LIVE INTEGRATION",
      badgeColor: "bg-orange-100 text-[#ff5a1f] border-orange-200",
    },
    {
      id: "razorpay",
      title: "Razorpay Payments",
      description: "Multi-rail gateway supporting all UPI apps, Cards, Wallets, and NetBanking.",
      badge: "AVAILABLE",
      badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
    },
    {
      id: "phonepe",
      title: "PhonePe PG",
      description: "Direct PhonePe PG with high UPI success rates and deep-linking.",
      badge: "AVAILABLE",
      badgeColor: "bg-purple-100 text-purple-700 border-purple-200",
    },
    {
      id: "cashfree",
      title: "Cashfree Payments",
      description: "Payment gateway with auto-refunds and multiple checkout payment modes.",
      badge: "AVAILABLE",
      badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-black text-gray-900 tracking-tight">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your payment gateways, checkout methods, and security preferences.</p>
      </div>

      <div className="space-y-8">
        {/* ========================================================================= */}
        {/* 1. PAYMENT GATEWAY & CHECKOUT METHODS CONFIGURATION                        */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#ff5a1f] flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Payment Gateway & Checkout Methods</h3>
                <p className="text-xs text-gray-500">Enable/disable payment options and choose your active payment processor.</p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
              <Server className="w-3.5 h-3.5 text-gray-500" />
              <span>Realtime Dynamic</span>
            </span>
          </div>

          {isPaymentLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#ff5a1f]" />
              <span className="text-sm">Loading gateway settings...</span>
            </div>
          ) : (
            <form onSubmit={handleSavePaymentSettings} className="space-y-6">
              {paymentSuccessMsg && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-green-600" />
                  <span>{paymentSuccessMsg}</span>
                </div>
              )}

              {paymentErrorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{paymentErrorMsg}</span>
                </div>
              )}

              {/* Sub-section A: Checkout Payment Methods Toggle */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                  1. Enable / Disable Checkout Payment Methods
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Toggle: Pay Online */}
                  <div 
                    onClick={() => {
                      if (paymentSettings.enableOnline && !paymentSettings.enableDesk) return; // Prevent disabling both
                      setPaymentSettings(prev => ({ ...prev, enableOnline: !prev.enableOnline }));
                    }}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start justify-between select-none ${
                      paymentSettings.enableOnline 
                        ? "border-[#ff5a1f] bg-orange-50/20" 
                        : "border-gray-200 bg-gray-50/50 opacity-70"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">Pay Online</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Allows customers to pay via UPI, NetBanking, and Cards online with slot locking.
                      </p>
                    </div>
                    <div className="pt-0.5 text-[#ff5a1f]">
                      {paymentSettings.enableOnline ? (
                        <ToggleRight className="w-7 h-7 text-[#ff5a1f]" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-gray-300" />
                      )}
                    </div>
                  </div>

                  {/* Toggle: Pay at Desk */}
                  <div 
                    onClick={() => {
                      if (paymentSettings.enableDesk && !paymentSettings.enableOnline) return; // Prevent disabling both
                      setPaymentSettings(prev => ({ ...prev, enableDesk: !prev.enableDesk }));
                    }}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start justify-between select-none ${
                      paymentSettings.enableDesk 
                        ? "border-[#ff5a1f] bg-orange-50/20" 
                        : "border-gray-200 bg-gray-50/50 opacity-70"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">Pay at Desk</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Front Desk
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Allows customers to reserve slots and pay in cash/card at the front desk counter.
                      </p>
                    </div>
                    <div className="pt-0.5 text-[#ff5a1f]">
                      {paymentSettings.enableDesk ? (
                        <ToggleRight className="w-7 h-7 text-[#ff5a1f]" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-gray-300" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Default payment method selection */}
                <div className="mt-4 p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-gray-700">Default Selected Method for Customers:</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                      <input 
                        type="radio" 
                        name="defaultMethod"
                        checked={paymentSettings.defaultMethod === "online"}
                        onChange={() => setPaymentSettings(prev => ({ ...prev, defaultMethod: "online" }))}
                        disabled={!paymentSettings.enableOnline}
                        className="text-[#ff5a1f] focus:ring-[#ff5a1f]"
                      />
                      <span>Pay Online First</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                      <input 
                        type="radio" 
                        name="defaultMethod"
                        checked={paymentSettings.defaultMethod === "desk"}
                        onChange={() => setPaymentSettings(prev => ({ ...prev, defaultMethod: "desk" }))}
                        disabled={!paymentSettings.enableDesk}
                        className="text-[#ff5a1f] focus:ring-[#ff5a1f]"
                      />
                      <span>Pay at Desk First</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sub-section B: Select Active Online Payment Gateway Provider */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                    2. Select Active Online Payment Gateway Provider
                  </label>
                  
                  {/* Environment Switcher */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-semibold">Environment:</span>
                    <select
                      value={paymentSettings.gatewayEnv}
                      onChange={(e) => setPaymentSettings(prev => ({ ...prev, gatewayEnv: e.target.value as GatewayEnvironment }))}
                      className="text-xs font-bold border border-gray-300 rounded-lg px-2.5 py-1 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                    >
                      <option value="live">🔴 Live (Production)</option>
                      <option value="test">🟡 Test / Sandbox</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {GATEWAY_CARDS.map(gw => {
                    const isSelected = paymentSettings.activeGateway === gw.id;
                    return (
                      <div
                        key={gw.id}
                        onClick={() => setPaymentSettings(prev => ({ ...prev, activeGateway: gw.id }))}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all select-none relative ${
                          isSelected
                            ? "border-[#ff5a1f] bg-orange-50/20 shadow-sm shadow-[#ff5a1f]/10"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-gray-900 text-sm">{gw.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${gw.badgeColor}`}>
                            {gw.badge}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">
                          {gw.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-[#ff5a1f] bg-[#ff5a1f]" : "border-gray-300 bg-white"
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-xs font-bold text-gray-700">
                            {isSelected ? "Active Gateway" : "Click to Activate"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sub-section C: Gateway Credentials Configuration Form */}
              <div className="pt-4 border-t border-gray-100 bg-gray-50/70 p-5 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-4 h-4 text-[#ff5a1f]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    3. Credentials for {GATEWAY_CARDS.find(g => g.id === paymentSettings.activeGateway)?.title}
                  </h4>
                </div>

                {/* 1. ICICI Credentials */}
                {paymentSettings.activeGateway === "icici" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Merchant ID</label>
                        <input
                          type="text"
                          value={paymentSettings.icici.merchantId}
                          onChange={(e) => setPaymentSettings(prev => ({
                            ...prev,
                            icici: { ...prev.icici, merchantId: e.target.value }
                          }))}
                          placeholder="e.g. 100000000531583"
                          className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Aggregator ID</label>
                        <input
                          type="text"
                          value={paymentSettings.icici.aggregatorId}
                          onChange={(e) => setPaymentSettings(prev => ({
                            ...prev,
                            icici: { ...prev.icici, aggregatorId: e.target.value }
                          }))}
                          placeholder="e.g. 100000000531582"
                          className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700">ICICI Secret Key (HMAC-SHA256)</label>
                        <button
                          type="button"
                          onClick={() => setShowSecrets(prev => ({ ...prev, icici: !prev.icici }))}
                          className="text-xs text-[#ff5a1f] flex items-center gap-1 font-semibold hover:underline"
                        >
                          {showSecrets.icici ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showSecrets.icici ? "Hide" : "Show"}</span>
                        </button>
                      </div>
                      <input
                        type={showSecrets.icici ? "text" : "password"}
                        value={paymentSettings.icici.secretKey}
                        onChange={(e) => setPaymentSettings(prev => ({
                          ...prev,
                          icici: { ...prev.icici, secretKey: e.target.value }
                        }))}
                        placeholder="••••••••••••••••••••••••••••••••"
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Razorpay Credentials */}
                {paymentSettings.activeGateway === "razorpay" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Razorpay Key ID</label>
                      <input
                        type="text"
                        value={paymentSettings.razorpay.keyId}
                        onChange={(e) => setPaymentSettings(prev => ({
                          ...prev,
                          razorpay: { ...prev.razorpay, keyId: e.target.value }
                        }))}
                        placeholder="rzp_live_..."
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700">Razorpay Key Secret</label>
                        <button
                          type="button"
                          onClick={() => setShowSecrets(prev => ({ ...prev, rzp: !prev.rzp }))}
                          className="text-xs text-[#ff5a1f] flex items-center gap-1 font-semibold hover:underline"
                        >
                          {showSecrets.rzp ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showSecrets.rzp ? "Hide" : "Show"}</span>
                        </button>
                      </div>
                      <input
                        type={showSecrets.rzp ? "text" : "password"}
                        value={paymentSettings.razorpay.keySecret}
                        onChange={(e) => setPaymentSettings(prev => ({
                          ...prev,
                          razorpay: { ...prev.razorpay, keySecret: e.target.value }
                        }))}
                        placeholder="••••••••••••••••"
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                  </div>
                )}

                {/* 3. PhonePe Credentials */}
                {paymentSettings.activeGateway === "phonepe" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">PhonePe Merchant ID</label>
                        <input
                          type="text"
                          value={paymentSettings.phonepe.merchantId}
                          onChange={(e) => setPaymentSettings(prev => ({
                            ...prev,
                            phonepe: { ...prev.phonepe, merchantId: e.target.value }
                          }))}
                          placeholder="e.g. PGTESTPAYUAT"
                          className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Salt Index</label>
                        <input
                          type="text"
                          value={paymentSettings.phonepe.saltIndex}
                          onChange={(e) => setPaymentSettings(prev => ({
                            ...prev,
                            phonepe: { ...prev.phonepe, saltIndex: e.target.value }
                          }))}
                          placeholder="1"
                          className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700">PhonePe Salt Key</label>
                        <button
                          type="button"
                          onClick={() => setShowSecrets(prev => ({ ...prev, phonepe: !prev.phonepe }))}
                          className="text-xs text-[#ff5a1f] flex items-center gap-1 font-semibold hover:underline"
                        >
                          {showSecrets.phonepe ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showSecrets.phonepe ? "Hide" : "Show"}</span>
                        </button>
                      </div>
                      <input
                        type={showSecrets.phonepe ? "text" : "password"}
                        value={paymentSettings.phonepe.saltKey}
                        onChange={(e) => setPaymentSettings(prev => ({
                          ...prev,
                          phonepe: { ...prev.phonepe, saltKey: e.target.value }
                        }))}
                        placeholder="••••••••••••••••"
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Cashfree Credentials */}
                {paymentSettings.activeGateway === "cashfree" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Cashfree App ID</label>
                      <input
                        type="text"
                        value={paymentSettings.cashfree.appId}
                        onChange={(e) => setPaymentSettings(prev => ({
                          ...prev,
                          cashfree: { ...prev.cashfree, appId: e.target.value }
                        }))}
                        placeholder="e.g. 123456789"
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-gray-700">Cashfree Secret Key</label>
                        <button
                          type="button"
                          onClick={() => setShowSecrets(prev => ({ ...prev, cf: !prev.cf }))}
                          className="text-xs text-[#ff5a1f] flex items-center gap-1 font-semibold hover:underline"
                        >
                          {showSecrets.cf ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showSecrets.cf ? "Hide" : "Show"}</span>
                        </button>
                      </div>
                      <input
                        type={showSecrets.cf ? "text" : "password"}
                        value={paymentSettings.cashfree.secretKey}
                        onChange={(e) => setPaymentSettings(prev => ({
                          ...prev,
                          cashfree: { ...prev.cashfree, secretKey: e.target.value }
                        }))}
                        placeholder="••••••••••••••••"
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Save Button */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={isPaymentSaving}
                  className="bg-[#ff5a1f] text-white px-7 py-2.5 rounded-xl font-bold hover:bg-[#e04812] transition-all flex items-center gap-2 shadow-sm disabled:opacity-60"
                >
                  {isPaymentSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isPaymentSaving ? "Saving Settings..." : "Save Payment Settings"}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 2. BUSINESS INFORMATION                                                   */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-3 mb-4">
            <Building2 className="w-5 h-5 text-[#ff5a1f]" />
            <h3 className="text-lg font-bold text-gray-900">Business Information</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input type="text" defaultValue="Havoc RC Funzone & Miniature World" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]" />
            </div>
            <button className="bg-[#ff5a1f] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#e04812] transition-colors mt-2">
              Save Business Details
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. SECURITY / PASSWORD MANAGEMENT                                         */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-5 h-5 text-[#ff5a1f]" />
            <h3 className="text-lg font-bold text-gray-900">Change Admin Password</h3>
          </div>
          <p className="text-sm text-gray-500 mb-6 border-b border-gray-100 pb-3">
            All passwords are protected with salted bcrypt hashing in the database.
          </p>

          {passwordState.error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordState.error}</span>
            </div>
          )}

          {passwordState.success && (
            <div className="mb-5 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-green-600" />
              <span>{passwordState.success}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">New Password (Min. 8 characters)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              />
            </div>

            <button
              type="submit"
              disabled={passwordState.isLoading}
              className="bg-[#0d1b2a] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-colors mt-2 disabled:opacity-60"
            >
              {passwordState.isLoading ? "Updating Password..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
