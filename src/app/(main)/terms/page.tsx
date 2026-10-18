import Link from "next/link";
import { ShieldCheck, Scale, AlertCircle, Phone, Mail, MapPin } from "lucide-react";

export const metadata = {
  title: "Terms & Conditions | Havoc RC Funzone",
  description: "Terms and conditions governing the use of Havoc RC Funzone services, facilities, booking portals, and online payments.",
};

export default function TermsPage() {
  return (
    <div className="py-8 md:py-16 bg-[#f8f9fa] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 md:p-12 lg:p-16 shadow-sm border border-gray-100">
          <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-4 uppercase">Legal &amp; Regulatory Framework</div>
          <h1 className="text-4xl md:text-5xl font-heading font-black text-[#0d1b2a] mb-4 tracking-tight">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-gray-500 mb-8 pb-6 border-b border-gray-100">
            Last Updated: October 2026 | Effective for all bookings and venue activities
          </p>
          
          <div className="space-y-10 text-gray-600 leading-relaxed text-[15px]">
            <p className="text-base text-gray-700 leading-relaxed">
              Welcome to <strong>Havoc RC Funzone &amp; Miniature World</strong> (&ldquo;Havoc&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), operated by Havoc Hobby Center Pvt. Ltd. These Terms and Conditions govern your access to and use of our website (<code className="text-[#ff5a1f]">https://havocrcfunzone.com</code>), online ticketing portal, payment gateway checkout, premises, equipment, racing simulators, and all associated recreation facilities.
            </p>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-2xl text-sm text-amber-900 leading-relaxed">
              <strong>Notice of Agreement:</strong> By accessing our website, purchasing an admission pass or simulator session, or stepping onto our premises at No. 90, Sabharwal Residency Building, 4th Floor, KH Double Road, Bengaluru, you expressly agree to abide by all terms, venue regulations, and payment guidelines detailed herein.
            </div>

            {/* 1. Customer Rights and Responsibilities */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4 flex items-center gap-2">
                <Scale className="w-6 h-6 text-[#ff5a1f]" />
                1. Customer Rights and Responsibilities
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200">
                  <h3 className="font-bold text-[#0d1b2a] mb-2 text-base">Your Rights as a Customer</h3>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-700 leading-relaxed">
                    <li>Right to transparent, up-front itemized pricing with clear 18% GST breakdowns before checkout.</li>
                    <li>Right to receive immediate digital booking confirmations, vouchers, and tax receipts.</li>
                    <li>Right to safe, clean, and professionally calibrated RC tracks and sim podiums.</li>
                    <li>Right to safety briefings and hands-on guidance from certified venue Marshals.</li>
                    <li>Right to request date rescheduling at zero penalty (up to 24 hours prior to slot).</li>
                    <li>Right to privacy and data protection under applicable Indian laws and PCI-DSS standards.</li>
                  </ul>
                </div>
                <div className="p-5 rounded-2xl bg-orange-50/60 border border-orange-200">
                  <h3 className="font-bold text-[#0d1b2a] mb-2 text-base">Your Responsibilities</h3>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-700 leading-relaxed">
                    <li>Provide accurate contact credentials (valid mobile number, email, and billing name).</li>
                    <li>Arrive at the arena 10–15 minutes before your scheduled slot time for track orientation.</li>
                    <li>Follow staff instructions, safety barriers, and emergency protocols at all times.</li>
                    <li>Supervise minors (children under 14 must be accompanied by an adult).</li>
                    <li>Refrain from reckless driving, intentional vehicle bashing, or physical track tampering.</li>
                    <li>Ensure payment authorization credentials (OTP, UPI PIN, card passwords) are securely handled.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 2. Transparent Pricing, Payment Breakdowns & Recurring Charges */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">
                2. Transparent Pricing, GST &amp; Payment Breakdown
              </h2>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                <li>
                  <strong>Itemized Pricing:</strong> All pass prices are displayed in Indian Rupees (INR - ₹). Base ticket tariffs and applicable taxes (Standard 18% GST) are computed and clearly shown as separate line items on the checkout summary prior to payment processing.
                </li>
                <li>
                  <strong>Payment Modes Accepted:</strong> Through our ICICI Bank Orange Payment Gateway integration and front-desk POS terminals, we accept UPI (Google Pay, PhonePe, Paytm, BHIM), Debit Cards, Credit Cards (Visa, MasterCard, RuPay, American Express, Diners Club), Net Banking (50+ banks), and authorized mobile wallets.
                </li>
                <li>
                  <strong>Zero Recurring Charges:</strong> All purchases at Havoc RC Funzone are <strong>strictly one-time, pay-per-session transactions</strong>. We do not operate recurring subscription billing, auto-renewal debit plans, or silent wallet deductions.
                </li>
              </ul>
            </section>

            {/* 3. Booking, Rescheduling & Admission */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">
                3. Booking, Rescheduling &amp; Admission
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Admission is strictly capacity-controlled to ensure a premium, uncrowded experience. Passes are valid only for the specific date and time slot reserved.</li>
                <li>Visitors must present their digital ticket QR code or booking reference code at the registration reception upon arrival.</li>
                <li><strong>Grace Period:</strong> In case of minor transit delays up to 15 minutes, we will make reasonable efforts to accommodate your session without reducing overall track duration, subject to arena schedule availability.</li>
                <li>For slot rescheduling, customers may contact support via email or phone up to 24 hours in advance at zero modification surcharge.</li>
              </ul>
            </section>

            {/* 4. Equipment Handling & Facility Safety */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">
                4. Facility Safety &amp; Equipment Care
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Professional-grade hobby RC cars, crawlers, drift chassis, and high-torque direct-drive sim rigs are provided for your session under supervised track control.</li>
                <li>Normal wear and tear is expected and absorbed by Havoc RC Funzone. However, deliberate vandalism, gross misconduct, or intentional hurling/smashing of controllers or vehicles will make the patron liable for repair/replacement costs.</li>
                <li>Personal RC equipment is permitted only during dedicated Open Track Days with prior written coordinator sign-off.</li>
              </ul>
            </section>

            {/* 5. Website Security & Payment Gateway Safe Harbor */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                5. Website Security &amp; Data Protection
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>HTTPS Protocol:</strong> Our entire website operates under strict Transport Layer Security (TLS 1.3 / SSL) over <code>https://</code>. All data exchanged between your browser and our servers is 256-bit encrypted.
                </li>
                <li>
                  <strong>Card Data Security (PCI-DSS):</strong> We do not store sensitive cardholder authentication details, PINs, or CVV codes on our servers. All financial transactions are channeled securely through <strong>ICICI Bank Orange Payment Gateway</strong> under Level-1 PCI-DSS compliant infrastructure.
                </li>
              </ul>
            </section>

            {/* 6. Refund & Cancellation Terms */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">
                6. Refund &amp; Cancellation Terms
              </h2>
              <p className="mb-3">
                Our detailed policy can be reviewed on our dedicated{" "}
                <Link href="/refund" className="text-[#ff5a1f] font-bold hover:underline">
                  Refund &amp; Cancellation Policy
                </Link>{" "}
                page. Highlights include:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Customer cancellations made &gt;24 hours in advance receive a 100% store credit or free slot rescheduling.</li>
                <li>In the rare event of arena technical outages or merchant cancellations, customers are entitled to a full 100% monetary refund credited directly to the original payment source within <strong>5 to 7 working days</strong>.</li>
              </ul>
            </section>

            {/* 7. Code of Conduct */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">
                7. Venue Code of Conduct
              </h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Smoking, vaping, chewing tobacco, and alcohol consumption are strictly prohibited throughout the indoor building premises.</li>
                <li>Patrons exhibiting aggressive language, intoxication, or harassment toward other guests or arena marshals will be escorted off premises without refund.</li>
                <li>Non-commercial personal photography and smartphone videos are warmly encouraged. Commercial videography requires prior facility permission.</li>
              </ul>
            </section>

            {/* 8. Governing Law & Dispute Resolution */}
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">
                8. Governing Law &amp; Jurisdiction
              </h2>
              <p>
                These Terms and Conditions shall be interpreted and governed in accordance with the laws of India. Any disputes or claims arising out of or related to these terms or transactions through our payment gateway shall be subject to the exclusive jurisdiction of the competent courts in Bengaluru, Karnataka.
              </p>
            </section>

            {/* 9. Contact Details */}
            <section className="bg-gray-50 rounded-2xl p-6 sm:p-8 border border-gray-200">
              <h2 className="text-xl font-black text-[#0d1b2a] font-heading mb-4">
                9. Merchant Contact Details &amp; Grievance Redressal
              </h2>
              <p className="mb-4 text-sm">
                For questions, service inquiries, or grievance redressal regarding these terms or your transactions:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-[#ff5a1f] shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-bold text-gray-900">Phone Support</span>
                    <a href="tel:+918951336255" className="text-gray-600 hover:text-[#ff5a1f]">+91 89513 36255</a>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-[#ff5a1f] shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-bold text-gray-900">Email Inquiries</span>
                    <a href="mailto:havocrcfunzone@gmail.com" className="text-gray-600 hover:text-[#ff5a1f]">havocrcfunzone@gmail.com</a>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#ff5a1f] shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-bold text-gray-900">Arena Address</span>
                    <span className="text-gray-600 text-xs">No. 90, 4th Floor, KH Double Rd, Shantinagar, Bengaluru 560027</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

