import Link from "next/link";
import { ShieldCheck, RefreshCw, XCircle, Clock, AlertCircle, HelpCircle, Mail, Phone, MapPin } from "lucide-react";

export const metadata = {
  title: "Refund & Cancellation Policy | Havoc RC Funzone",
  description: "Official Refund, Cancellation, Rescheduling, and Payment Breakdown Policy for Havoc RC Funzone.",
};

export default function RefundPolicyPage() {
  return (
    <div className="py-10 md:py-16 bg-[#f8f9fa] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 md:p-12 lg:p-16 shadow-sm border border-gray-100">
          
          {/* Header */}
          <div className="border-b border-gray-100 pb-8 mb-10">
            <div className="text-xs font-black tracking-widest text-[#ff5a1f] mb-3 uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Official Merchant Policy</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black text-[#0d1b2a] tracking-tight">
              Refund &amp; Cancellation Policy
            </h1>
            <p className="text-sm text-gray-500 mt-3">
              Last updated: October 18, 2026 • Compliant with Indian Consumer Protection regulations &amp; ICICI Bank Payment Gateway standards.
            </p>
          </div>

          <div className="space-y-10 text-gray-600 leading-relaxed text-sm sm:text-base">
            
            {/* 1. Overview */}
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-black text-[#0d1b2a] font-heading flex items-center gap-2">
                <span>1. Nature of Services &amp; Overview</span>
              </h2>
              <p>
                <strong>Havoc RC Funzone &amp; Miniature World</strong> (A Division of Havoc Hobby Center Pvt. Ltd.) provides scheduled, capacity-controlled entry passes and timed simulator access for radio-controlled tracks, model railway exhibits, and flight/racing simulators.
              </p>
              <p>
                Because ticket slots reserve exclusive arena capacity and equipment for a specific date and time, purchases are subject to the cancellation and refund rules detailed below.
              </p>
            </section>

            {/* 2. Cancellation Policy */}
            <section className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-[#0d1b2a] font-heading flex items-center gap-2">
                <XCircle className="w-5 h-5 text-[#ff5a1f]" />
                <span>2. Cancellation Policy</span>
              </h2>
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200/80 space-y-3 text-sm">
                <p>
                  <strong>Customer-Initiated Cancellations:</strong>
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Standard Passes &amp; Timed Slots:</strong> Tickets are non-refundable once purchased, as slot capacity is blocked exclusively for you and cannot be re-allocated to other walk-in or online visitors once booked.
                  </li>
                  <li>
                    <strong>Advance Rescheduling Request (Minimum 24 Hours Notice):</strong> If you cannot attend your scheduled session, you may request to reschedule your booking to another available date/time by contacting support at least <strong>24 hours prior</strong> to your booked slot time. Rescheduling is subject to slot availability.
                  </li>
                  <li>
                    <strong>No-Shows:</strong> Failure to arrive for your booked slot without prior notice will be treated as a no-show, and the ticket amount will be forfeited in full.
                  </li>
                </ul>
              </div>
            </section>

            {/* 3. Refund Policy & Operational Cancellations */}
            <section className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-[#0d1b2a] font-heading flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-600" />
                <span>3. Refund Policy &amp; Merchant-Initiated Cancellations</span>
              </h2>
              <p>
                We strive to ensure all simulator rigs, tracks, and arena facilities operate seamlessly. However, in the rare event of:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Technical failure of booked simulation equipment or arena maintenance resulting in session cancellation.</li>
                <li>Venue closure due to unforeseen circumstances, power failure, or government mandates.</li>
                <li>Accidental duplicate payment deductions caused by gateway/network latency.</li>
              </ul>
              <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-200/70 text-emerald-950 text-sm space-y-2">
                <p className="font-bold text-emerald-900">In such circumstances, customers are entitled to:</p>
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>An immediate priority reschedule to any date and time slot of their choice, <strong>OR</strong></li>
                  <li>A <strong>100% full refund</strong> of the ticket price paid.</li>
                </ol>
              </div>
            </section>

            {/* 4. Refund Process & Timelines */}
            <section className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-[#0d1b2a] font-heading flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span>4. Refund Timelines &amp; Mode of Settlement</span>
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Approved Refunds:</strong> Once an eligible refund or duplicate transaction is confirmed by our accounts team, the refund will be initiated within <strong>24 to 48 hours</strong>.
                </li>
                <li>
                  <strong>Original Payment Method:</strong> All refunds are processed directly back to the original source of payment (Credit Card, Debit Card, Net Banking, or UPI) via our banking partner (ICICI Bank Orange Payment Gateway).
                </li>
                <li>
                  <strong>Bank Processing Time:</strong> Credit to your bank account typically reflects within <strong>5 to 7 business days</strong> depending on your issuing bank&apos;s settlement schedule.
                </li>
                <li>
                  <strong>No Cash Refunds:</strong> For digital transactions, refunds cannot be paid out in physical cash at the venue counter.
                </li>
              </ul>
            </section>

            {/* 5. Pricing and Payment Breakdown */}
            <section className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-black text-[#0d1b2a] font-heading flex items-center gap-2">
                <span>5. Transparent Pricing &amp; GST Breakdown</span>
              </h2>
              <p>
                All prices on Havoc RC Funzone are clearly published in Indian Rupees (INR) with complete tax transparency:
              </p>
              <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-bold text-gray-700">
                    <tr>
                      <th className="py-3 px-4">Pass Category</th>
                      <th className="py-3 px-4">Base Price</th>
                      <th className="py-3 px-4">GST (18%)</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Includes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 px-4 font-bold text-gray-900">Visitor Pass</td>
                      <td className="py-3 px-4">₹300.00</td>
                      <td className="py-3 px-4">₹54.00</td>
                      <td className="py-3 px-4 font-black text-[#ff5a1f]">₹354.00</td>
                      <td className="py-3 px-4 text-xs text-gray-500">1-Hour companion &amp; observation access</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-gray-900">VIP Visitor Pass</td>
                      <td className="py-3 px-4">₹500.00</td>
                      <td className="py-3 px-4">₹90.00</td>
                      <td className="py-3 px-4 font-black text-[#ff5a1f]">₹590.00</td>
                      <td className="py-3 px-4 text-xs text-gray-500">Flight sim, Model railway &amp; Race sim rig</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-gray-900">Participant Pass</td>
                      <td className="py-3 px-4">₹1,000.00</td>
                      <td className="py-3 px-4">₹180.00</td>
                      <td className="py-3 px-4 font-black text-[#ff5a1f]">₹1,180.00</td>
                      <td className="py-3 px-4 text-xs text-gray-500">Full 1-hour access to 15 RC zones (Excavator extra)</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-bold text-gray-900">VIP Participant Pass</td>
                      <td className="py-3 px-4">₹1,500.00</td>
                      <td className="py-3 px-4">₹270.00</td>
                      <td className="py-3 px-4 font-black text-[#ff5a1f]">₹1,770.00</td>
                      <td className="py-3 px-4 text-xs text-gray-500">15 RC zones (Excavator extra) + Upgraded RC cars + 30-min Sim Podium session</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 italic">
                * Note: Zero hidden fees. The exact breakdown (Subtotal, 18% GST, and Discounts) is displayed on the screen before final payment authorization.
              </p>
            </section>

            {/* 6. Recurring Charges / Subscriptions */}
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-black text-[#0d1b2a] font-heading">
                6. Recurring Charges &amp; Subscriptions
              </h2>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-sm">
                <p>
                  <strong>No Recurring Charges:</strong> Havoc RC Funzone does <strong>NOT</strong> charge any auto-renewal fees, monthly subscriptions, or recurring credit card debits. Every transaction is a one-time purchase initiated explicitly by the customer for the chosen booking slot.
                </p>
              </div>
            </section>

            {/* 7. How to Request a Refund / Support Contact */}
            <section className="space-y-4 pt-4 border-t border-gray-100">
              <h2 className="text-xl sm:text-2xl font-black text-[#0d1b2a] font-heading flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#ff5a1f]" />
                <span>7. How to Contact Us for Refund Inquiries</span>
              </h2>
              <p>
                To request assistance with an issue, cancellation, duplicate charge, or rescheduling, please write to us with your <strong>Order ID</strong> (e.g. #PAYDUE_... or transaction reference number) and registered phone number:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    <Mail className="w-4 h-4 text-[#ff5a1f]" />
                    <span>Email Support</span>
                  </div>
                  <a href="mailto:havocrcfunzone@gmail.com" className="text-sm font-bold text-[#ff5a1f] hover:underline block break-all">
                    havocrcfunzone@gmail.com
                  </a>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    <Phone className="w-4 h-4 text-[#ff5a1f]" />
                    <span>Phone / WhatsApp</span>
                  </div>
                  <a href="tel:+918951336255" className="text-sm font-bold text-gray-900 hover:text-[#ff5a1f] block">
                    +91 89513 36255
                  </a>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    <MapPin className="w-4 h-4 text-[#ff5a1f]" />
                    <span>Physical Venue</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-snug">
                    4th Floor, Sabharwal Residency, KH Double Rd, Shantinagar, Bengaluru 560027
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
