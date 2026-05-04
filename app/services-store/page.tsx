import Image from 'next/image'
import ContactForm from './ContactForm'

const services = [
  {
    name: 'Standard Print',
    price: '$99.00',
    description: 'Perfect for simple desk organizers with clean lines. Includes one color, standard infill, and a smooth finish.',
    image: '/services/standard.jpg',
  },
  {
    name: 'Intermediate Service',
    price: '$149.00',
    description: 'For more complex designs with multiple compartments or custom dimensions. Includes premium finish and color matching.',
    image: '/services/intermediate.jpg',
  },
]

export default function ServicesStorePage() {
  return (
    <div>
      {/* Section 1 — Hero Banner */}
      <section className="w-full h-[50vh] min-h-[400px] relative bg-taupe/30">
        {/* Replace with your hero image: /public/hero-living-room.jpg */}
        <Image
          src="/hero-living-room.jpg"
          alt="Cozy living space with 3D printed organizers"
          fill
          className="object-cover"
          priority
          unoptimized
        />
      </section>

      {/* Section 2 — Services Intro */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-start">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display leading-tight">
            Our Printing Services
          </h2>
          <p className="text-warm-gray text-base sm:text-lg leading-relaxed">
            We specialize in one thing: high-quality 3D printed desk organizers. Every print is made to order and priced per print hour, so you only pay for exactly what&apos;s made. No mass production, no shortcuts — just precision craftsmanship tailored to your space.
          </p>
        </div>
      </section>

      {/* Section 3 — Service Listings */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
        <div className="space-y-12">
          {services.map((service) => (
            <div key={service.name} className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
              {/* Thumbnail */}
              <div className="w-[150px] h-[150px] shrink-0 rounded-lg overflow-hidden bg-taupe/20 relative">
                <Image
                  src={service.image}
                  alt={service.name}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Name + Description */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <h3 className="text-2xl sm:text-3xl font-display">{service.name}</h3>
                  <span className="text-xl font-display text-charcoal shrink-0">{service.price}</span>
                </div>
                <p className="text-warm-gray text-base leading-relaxed">{service.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4 — Contact/CTA Form */}
      <section id="contact" className="bg-taupe/40 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Left — Heading */}
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display leading-tight mb-4">
                Ready to Unleash Your Print?
              </h2>
              <p className="text-warm-gray text-lg">
                Complete the form. Let&apos;s build something unstoppable.
              </p>
            </div>

            {/* Right — Form */}
            <ContactForm />
          </div>
        </div>
      </section>
    </div>
  )
}
