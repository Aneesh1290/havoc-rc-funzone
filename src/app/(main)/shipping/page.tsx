import Link from "next/link";
import { Truck, CheckCircle2, ShieldCheck, Mail, Phone, MapPin, Clock, Globe } from "lucide-react";

export const metadata = {
  title: "Shipping & Delivery Policy | Havoc RC Funzone",
  description: "Shipping and Delivery Policy for booking passes and services at Havoc RC Funzone.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="py-8 md:py-16 bg-[#f8f9fa] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 md:p-12 lg:p-16 shadow-sm border border-gray-100">
          <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-4 uppercase">
            Service Fulfillment &amp; Logistics
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-black text-[#0d1b2a] mb-6 tracking-tight">
            Shipping &amp; Delivery Policy
          </h1>
          <p className="text-sm text-gray-500 mb-8 pb-6 border-b border-gray-100">
            Last Updated: October 2026 | Effective Date: Immediately
          </p>

          <div className="space-y-10 text-gray-600 leading-relaxed text-[15px]">
            {/* Overview Banner */}
            <div className="bg-[#0d1b2a] text-white p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-6 shadow-lg shadow-[#0d1b2a]/10">
              <div className="w-14 h-14 rounded-2xl bg-[#ff5a1f]/20 border border-[#ff5a1f]/30 flex items-center justify-center shrink-0">
                <Truck className="w-7 h-7 text-[#ff5a1f]" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-1">Instant Digital Service Delivery</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Havoc RC Funzone operates on-premise entertainment experiences (RC racing tracks, off-road crawling arenas, and motion racing simulators). All admission passes and booking tickets are delivered <strong className="text-white">instantly in digital format</strong> with zero shipping fees.
                </p>
              </div>
            </div>

            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4 flex items-center gap-2">
                1. Nature of Products &amp; Services
              </h2>
              <p className="mb-3">
                All purchases made on this website (<span>https://havocrcfunzone.com</span> or authorized booking portals) are for time-based entertainment service access passes (&ldquo;PlayPasses&rdquo;, &ldquo;Podium Sim Slots&rdquo;, or event registrations) at our venue:
              </p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/80 mb-3 text-sm text-gray-800">
                <strong>Venue Address:</strong> No. 90, Sabharwal Residency Building, 4th Floor, KH Double Road, Above KFC Shantinagar KH, Bengaluru, Karnataka 560027, India.
              </div>
              <p>
                Because our bookings represent capacity-controlled physical service reservations, <strong>no tangible physical goods requiring courier dispatch are shipped by default</strong>.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4 flex items-center gap-2">
                2. Shipping &amp; Delivery Charges
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-[#ff5a1f]/5 border border-[#ff5a1f]/20">
                  <span className="text-xs font-bold text-[#ff5a1f] uppercase tracking-wider block mb-1">Delivery Fee</span>
                  <div className="text-2xl font-black text-[#0d1b2a] mb-1">₹0.00 (FREE)</div>
                  <p className="text-xs text-gray-500">Zero shipping or courier charges apply to all online pass bookings and digital receipts.</p>
                </div>
                <div className="p-5 rounded-2xl bg-green-50 border border-green-200">
                  <span className="text-xs font-bold text-green-700 uppercase tracking-wider block mb-1">Fulfillment Mode</span>
                  <div className="text-2xl font-black text-[#0d1b2a] mb-1">Instant Electronic Transfer</div>
                  <p className="text-xs text-gray-600">Delivered immediately on-screen, via SMS, and via Email upon checkout completion.</p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4 flex items-center gap-2">
                3. Delivery Methods &amp; Transmission
              </h2>
              <p className="mb-4">Once your transaction is verified through our ICICI Bank Orange Payment Gateway or confirmed at desk:</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>On-Screen Confirmation:</strong> Your unique Order ID, QR token, and ticket breakdown are immediately presented on your screen for instant download or screenshot.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Email Confirmation:</strong> A tax-compliant GST receipt and digital admission pass will be automatically dispatched to the customer&apos;s registered email address within <strong>5 minutes</strong>.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>SMS Notification:</strong> Booking reference numbers are sent via SMS to verified domestic and international mobile numbers.
                  </div>
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4 flex items-center gap-2">
                4. Estimated Delivery Time
              </h2>
              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#0d1b2a] text-white">
                    <tr>
                      <th className="py-3 px-4 font-bold">Item Type</th>
                      <th className="py-3 px-4 font-bold">Delivery Channel</th>
                      <th className="py-3 px-4 font-bold">Estimated Turnaround</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    <tr>
                      <td className="py-3 px-4 font-medium text-gray-900">Digital PlayPass / Slot Ticket</td>
                      <td className="py-3 px-4 text-gray-600">Web Browser Screen</td>
                      <td className="py-3 px-4 font-bold text-emerald-600">Immediate (0 seconds)</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium text-gray-900">Email Booking Voucher &amp; Invoice</td>
                      <td className="py-3 px-4 text-gray-600">Registered Email Inbox</td>
                      <td className="py-3 px-4 text-gray-600">Within 1 to 5 minutes</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium text-gray-900">SMS Booking Code</td>
                      <td className="py-3 px-4 text-gray-600">Mobile SMS Gateway</td>
                      <td className="py-3 px-4 text-gray-600">Within 1 to 3 minutes</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium text-gray-900">Physical SmartCard / Wristband</td>
                      <td className="py-3 px-4 text-gray-600">Handed at Arena Front Desk</td>
                      <td className="py-3 px-4 text-gray-600">At scheduled check-in time</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4 flex items-center gap-2">
                5. Geographic Coverage &amp; Restrictions (Domestic &amp; International)
              </h2>
              <div className="space-y-3">
                <p>
                  <strong>Domestic Customers (India):</strong> Customers across all Indian states and Union Territories may purchase slot tickets online without restriction.
                </p>
                <p>
                  <strong>International Customers:</strong> Visitors from abroad traveling to Bengaluru may book admission passes using international credit cards (Visa, MasterCard, American Express, Diners Club). Digital vouchers are sent to any valid international email address.
                </p>
                <p>
                  <strong>Shipping Area Restrictions:</strong> As there is no physical merchandise dispatch, <strong>there are no geographical shipping restrictions or non-deliverable PIN codes</strong>. Anyone globally with internet access can reserve a slot.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4 flex items-center gap-2">
                6. Non-Receipt of Digital Pass &amp; Support Escalation
              </h2>
              <p className="mb-4">
                If you have completed your payment but did not receive your confirmation email/SMS within 15 minutes, please perform the following:
              </p>
              <ol className="list-decimal pl-5 space-y-2 mb-4">
                <li>Check your spam/junk folder for an email from <code>havocrcfunzone@gmail.com</code>.</li>
                <li>Verify that the mobile number and email entered during checkout were correct.</li>
                <li>Contact our front desk support team with your payment transaction ID or bank debit reference. Our team will verify the payment and reissue your ticket immediately.</li>
              </ol>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm">
                <strong>Support Email:</strong> <a href="mailto:havocrcfunzone@gmail.com" className="text-[#ff5a1f] font-semibold hover:underline">havocrcfunzone@gmail.com</a> | <strong>Helpline:</strong> <a href="tel:+918951336255" className="text-gray-900 font-bold hover:underline">+91 89513 36255</a> (Daily 11:00 AM – 9:00 PM IST)
              </div>
            </section>

            {/* Section 7 */}
            <section className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-gray-500">
              <div>
                See also our{" "}
                <Link href="/terms" className="text-[#ff5a1f] font-semibold hover:underline">Terms &amp; Conditions</Link>{" "}
                and{" "}
                <Link href="/refund" className="text-[#ff5a1f] font-semibold hover:underline">Refund Policy</Link>.
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>ICICI Bank Payment Gateway Compliant</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
