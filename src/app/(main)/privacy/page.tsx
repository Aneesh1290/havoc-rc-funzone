export default function PrivacyPage() {
  return (
    <div className="py-8 md:py-16 bg-[#f8f9fa] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 md:p-12 lg:p-16 shadow-sm border border-gray-100">
          <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-4 uppercase">Legal Information</div>
          <h1 className="text-4xl md:text-5xl font-heading font-black text-[#0d1b2a] mb-12 tracking-tight">
            Privacy Policy
          </h1>
          
          <div className="space-y-10 text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">1. Introduction</h2>
              <p>Welcome to Havoc RC Funzone. Your privacy is important to us. This Privacy Policy explains how we collect, use, disclose, and protect your information when you visit our website www.havocrcfunzone.in / www.havocrcfunzone.com, interact with us, or use our services. By accessing or using our website and services, you agree to the collection and use of your information as described in this policy.</p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">2. Information We Collect</h2>
              <p className="mb-4">We collect different types of information to improve our services and enhance your experience. This may include:</p>
              
              <h3 className="font-bold text-[#0d1b2a] mb-2">a) Personal Information (Provided by You)</h3>
              <ul className="list-disc pl-5 mb-4 space-y-2">
                <li><strong>Contact Information:</strong> Name, email address, phone number</li>
                <li><strong>Booking Details:</strong> Event reservations, inquiries</li>
                <li><strong>Payment Information:</strong> (If applicable) Billing details for transactions</li>
                <li><strong>Feedback & Reviews:</strong> Any information you provide via surveys, comments, or reviews</li>
              </ul>

              <h3 className="font-bold text-[#0d1b2a] mb-2">b) Non-Personal Information (Collected Automatically)</h3>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Device Information:</strong> IP address, browser type, operating system</li>
                <li><strong>Usage Data:</strong> Pages visited, time spent on the website, referral sources</li>
                <li><strong>Cookies & Tracking Data:</strong> Used to improve user experience and website functionality</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">3. How We Use Your Information</h2>
              <p className="mb-4">We use the collected information to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Process bookings and inquiries</li>
                <li>Provide customer support and respond to requests</li>
                <li>Improve our website and services</li>
                <li>Send promotional offers, updates, and event details (only with your consent)</li>
                <li>Prevent fraud, security threats, or unauthorized access</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">4. How We Share Your Information</h2>
              <p className="mb-4">We do not sell, trade, or rent your personal information. However, we may share your data in the following cases:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>With Service Providers:</strong> To help us operate the website (e.g., payment processors, email services)</li>
                <li><strong>Legal Compliance:</strong> If required by law, legal proceedings, or government requests</li>
                <li><strong>Business Transfers:</strong> In case of a merger, acquisition, or business restructuring</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">5. Cookies & Tracking Technologies</h2>
              <p className="mb-2">We use cookies to enhance your browsing experience. These help us understand how visitors interact with our site and improve performance.</p>
              <p>You can disable cookies in your browser settings, but some features of our website may not function properly without them.</p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">6. Data Security</h2>
              <p>We take data protection seriously and implement security measures to safeguard your personal information. However, no online platform is completely secure. If you believe your data has been compromised, please contact us immediately.</p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">7. Your Rights & Choices</h2>
              <p className="mb-4">Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-5 mb-4 space-y-2">
                <li>Access the personal data we hold about you</li>
                <li>Request corrections or updates to your information</li>
                <li>Opt out of marketing communications</li>
                <li>Request data deletion (subject to legal limitations)</li>
              </ul>
              <p>To exercise your rights, contact us at: <a href="mailto:havocrcfunzone@gmail.com" className="text-[#ff5a1f] hover:underline font-bold">havocrcfunzone@gmail.com</a></p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">8. Third-Party Links & External Websites</h2>
              <p>Our website may contain links to third-party websites. We are not responsible for their privacy practices, so we recommend reviewing their privacy policies separately.</p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">9. Updates to This Privacy Policy</h2>
              <p>We may update this Privacy Policy from time to time. Changes will be posted on this page, and the updated date will be mentioned at the top. Please check periodically for any updates.</p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">10. Contact Us</h2>
              <p className="mb-2">If you have any questions or concerns regarding this Privacy Policy, feel free to contact us:</p>
              <ul className="space-y-1">
                <li><strong>Email:</strong> <a href="mailto:havocrcfunzone@gmail.com" className="text-[#ff5a1f] hover:underline">havocrcfunzone@gmail.com</a></li>
                <li><strong>Address:</strong> No. 90, Sabharwal Residency Building, 4th Floor, KH Double Road, Above KFC Shantinagar KH, Bengaluru, Karnataka 560027</li>
                <li><strong>Phone:</strong> +91 89513 36255</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
