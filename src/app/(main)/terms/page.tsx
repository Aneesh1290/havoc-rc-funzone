export default function TermsPage() {
  return (
    <div className="py-8 md:py-16 bg-[#f8f9fa] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 md:p-12 lg:p-16 shadow-sm border border-gray-100">
          <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-4 uppercase">Legal Information</div>
          <h1 className="text-4xl md:text-5xl font-heading font-black text-[#0d1b2a] mb-12 tracking-tight">
            Terms & Conditions
          </h1>
          
          <div className="space-y-10 text-gray-600 leading-relaxed">
            <p className="text-lg">Welcome to Havoc RC Funzone! These Terms and Conditions govern your access to and use of our website, services, premises, and any activities conducted through or at Havoc RC Funzone. By visiting our venue, using our services, or accessing our online platforms, you agree to comply with and be bound by the following terms.</p>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">1. General Rules</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>All participants must adhere to safety instructions provided by staff and signage at the venue.</li>
                <li>Children under 14 must be supervised by a responsible adult at all times.</li>
                <li>Havoc RC Funzone reserves the right to refuse entry or remove guests not complying with the rules or displaying inappropriate behavior.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">2. Booking & Admission</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Bookings can be made online or at the venue. Admission is subject to availability.</li>
                <li>Entry passes (PlayPasses) are valid only for the date and time selected at the time of purchase.</li>
                <li>Please retain your digital or physical ticket for the duration of your visit.</li>
                <li>We reserve the right to change pricing, availability, or operating hours without prior notice.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">3. Use of Facilities</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>All RC vehicles and equipment must be handled with care and only as instructed.</li>
                <li>Any damage to property due to misuse or negligence will be charged to the participant.</li>
                <li>Outside RC equipment or toys are not permitted unless explicitly approved by management.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">4. Safety & Liability</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Participation in RC activities involves inherent risks. By entering the premises, you accept full responsibility for your actions and waive any claims against Havoc RC Funzone for injuries or damages sustained during your visit.</li>
                <li>We are not liable for any loss, theft, or damage to personal belongings.</li>
                <li>Safety gear and instructions must be followed at all times. Failure to do so may result in removal from the activity or venue.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">5. Cancellations & Refunds</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>All ticket sales are final. We do not offer refunds or exchanges once a booking is confirmed.</li>
                <li>In the event of cancellations due to technical or operational reasons from our end, we may offer rescheduling at our discretion.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">6. Photography & Media</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>We may capture photos or videos during events and regular operations for promotional purposes. By entering the venue, you consent to the use of your image in our marketing material, website, and social media.</li>
                <li>If you do not wish to appear in such media, please inform our staff prior to entry.</li>
                <li>Personal photography is allowed for non-commercial use only.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">7. Code of Conduct</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Respect fellow guests, staff, and property.</li>
                <li>Abusive language, aggressive behavior, or acts of vandalism will not be tolerated and may result in removal from the premises without refund.</li>
                <li>Smoking, vaping, and alcohol consumption are strictly prohibited on-site.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">8. Changes to Terms</h2>
              <p>Havoc RC Funzone reserves the right to update or modify these Terms & Conditions at any time. Any changes will be posted on our website, and continued use of our services indicates acceptance of the updated terms.</p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">9. Contact Information</h2>
              <p className="mb-2">For questions or concerns regarding these Terms & Conditions, please contact us at:</p>
              <ul className="space-y-1">
                <li><strong>Email:</strong> <a href="mailto:havocrcfunzone@gmail.com" className="text-[#ff5a1f] hover:underline">havocrcfunzone@gmail.com</a></li>
                <li><strong>Phone:</strong> +91 89513 36255</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
