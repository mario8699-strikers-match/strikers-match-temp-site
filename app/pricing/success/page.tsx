'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function PaymentSuccessPage() {
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    // Extract plan from URL or just show generic success
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      // We could fetch session details from Stripe, but for simplicity
      // just show a generic success. The webhook handles the actual upgrade.
      setPlanName('confirmed');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans flex flex-col">
      <Navbar activePage={null} />

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center py-20">
          {/* Checkmark */}
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-black uppercase text-white mb-3" style={{ letterSpacing: '-0.5px' }}>
            {planName ? 'Pago exitoso' : 'Procesando...'}
          </h1>
          <p className="text-sm text-[#9A9A9A] mb-8 leading-relaxed">
            Tu plan ha sido activado. Ya puedes enviar solicitudes de pelea y acceder a todas las funciones de tu plan.
          </p>

          <div className="space-y-3">
            <a
              href="/events"
              className="block w-full py-3 text-sm font-bold tracking-widest uppercase text-white transition-colors"
              style={{ background: '#C0001E' }}
            >
              Ver eventos
            </a>
            <a
              href="/fighters"
              className="block w-full py-3 text-sm font-bold tracking-widest uppercase text-white border border-[#3A3A3A] hover:border-white transition-colors"
            >
              Buscar peleadores
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
