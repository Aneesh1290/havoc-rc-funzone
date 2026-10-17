export default function AccessibilityPage() {
  return (
    <div className="py-8 md:py-16 bg-[#f8f9fa] min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 md:p-12 lg:p-16 shadow-sm border border-gray-100">
          <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-4 uppercase">Legal Information</div>
          <h1 className="text-4xl md:text-5xl font-heading font-black text-[#0d1b2a] mb-12 tracking-tight">
            Accessibility Statement
          </h1>
          
          <div className="space-y-10 text-gray-600 leading-relaxed">
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">Our Commitment to Inclusion:</h2>
              <p>At Havoc RC Funzone, accessibility is at the heart of our mission to create engaging and inclusive RC experiences for everyone. We believe that fun, learning, and exploration should be available to all, regardless of age, ability, or background. We are committed to identifying and removing any barriers that may prevent individuals from fully participating in our activities or accessing our information and services.</p>
            </section>
            
            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">Accessibility at Our Venue:</h2>
              <p>Our physical space in Bangalore is thoughtfully designed to accommodate visitors with varying mobility needs. The venue includes accessible entryways, wide aisles for wheelchairs, ramps, and clearly marked signage to support safe and independent movement. Staff members are trained to offer respectful assistance to guests who may require extra help navigating the premises or participating in specific activities. We continue to invest in improvements that enhance the comfort and accessibility of our environment.</p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">Website and Digital Access:</h2>
              <p>Our digital experiences are designed with accessibility in mind. The Havoc RC Funzone website is regularly tested and updated to support screen readers, keyboard-only navigation, and browser zoom. We follow best practices outlined in the Web Content Accessibility Guidelines (WCAG) to ensure that all users can navigate, read, and interact with our content with ease. Features such as alt text for images, sufficient color contrast, clear fonts, and responsive layouts are standard in our digital design.</p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">Communication Support:</h2>
              <p>We want all our guests to feel heard and understood. If you require communication in a different format—whether that's large print, plain language, or assistance through a staff member—we'll do our best to accommodate your needs. Just let us know ahead of your visit or when you arrive, and we'll assist accordingly.</p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">Feedback and Continuous Improvement:</h2>
              <p>We understand that accessibility is an ongoing journey. That's why we welcome and encourage feedback from our visitors on how we can do better. If you notice any obstacles, limitations, or areas where we can improve your experience—either on-site or online—we invite you to share your thoughts with us.</p>
            </section>

            <section>
              <h2 className="text-2xl font-black text-[#0d1b2a] font-heading mb-4">Contact Us:</h2>
              <p className="mb-2">If you have questions about accessibility, need accommodations, or wish to offer suggestions, please don't hesitate to get in touch with us. We're here to help.</p>
              <ul className="space-y-1">
                <li><strong>Email:</strong> <a href="mailto:havocrcfunzone@gmail.com" className="text-[#ff5a1f] hover:underline">havocrcfunzone@gmail.com</a></li>
                <li><strong>Phone:</strong> +91 89513 36255</li>
              </ul>
              <p className="mt-4 font-bold text-[#0d1b2a]">Thank you for helping us create a space where everyone can play, learn, and explore without limits.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
