export default function RefundPage() {
  return (
    <div className="py-8 md:py-16 bg-[#f8f9fa] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 md:p-12 lg:p-16 shadow-sm border border-gray-100">
          <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-4 uppercase">Legal Information</div>
          <h1 className="text-4xl md:text-5xl font-heading font-black text-[#0d1b2a] mb-12 tracking-tight">
            Refund Policy
          </h1>
          
          <div className="space-y-10 text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">Cancellations & Refunds</h2>
              <ul className="list-disc pl-5 space-y-4">
                <li>All ticket sales are final. We do not offer refunds or exchanges once a booking is confirmed.</li>
                <li>In the event of cancellations due to technical or operational reasons from our end, we may offer rescheduling at our discretion.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
