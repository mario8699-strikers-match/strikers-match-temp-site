'use client';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { supabase } from '@/lib/supabaseClient';

type PlanKey = 'basic' | 'pro' | 'per_request';

const PLANS: {
  name: string;
  planKey: PlanKey;
  price: string;
  period: string;
  highlight: boolean;
  features: { label: string; value: string | boolean }[];
  cta: string;
}[] = [
  {
    name: 'BASIC',
    planKey: 'basic',
    price: '$199',
    period: 'MXN / mes',
    highlight: false,
    features: [
      { label: 'Solicitudes de pelea', value: '10 / mes' },
      { label: 'Reemplazo de emergencia', value: false },
      { label: 'Filtros avanzados', value: true },
      { label: 'Visibilidad prioritaria', value: false },
    ],
    cta: 'Elegir Basic',
  },
  {
    name: 'PRO',
    planKey: 'pro',
    price: '$399',
    period: 'MXN / mes',
    highlight: true,
    features: [
      { label: 'Solicitudes de pelea', value: 'Ilimitadas' },
      { label: 'Reemplazo de emergencia', value: true },
      { label: 'Filtros avanzados', value: true },
      { label: 'Visibilidad prioritaria', value: true },
    ],
    cta: 'Elegir Pro',
  },
  {
    name: 'PAY-AS-YOU-GO',
    planKey: 'per_request',
    price: '$49',
    period: 'MXN / solicitud',
    highlight: false,
    features: [
      { label: 'Solicitudes de pelea', value: 'Paga por cada una' },
      { label: 'Reemplazo de emergencia', value: '$99 / uso' },
      { label: 'Filtros avanzados', value: true },
      { label: 'Visibilidad prioritaria', value: false },
    ],
    cta: 'Empezar',
  },
];

const COMPARISON = [
  { feature: 'Solicitudes de pelea', basic: '10 / mes', pro: 'Ilimitadas', payg: '$49 c/u' },
  { feature: 'Reemplazo de emergencia', basic: '—', pro: 'Incluido', payg: '$99 / uso' },
  { feature: 'Filtros avanzados', basic: 'Si', pro: 'Si', payg: 'Si' },
  { feature: 'Visibilidad prioritaria', basic: '—', pro: 'Si', payg: '—' },
  { feature: 'Soporte prioritario', basic: '—', pro: 'Si', payg: '—' },
  { feature: 'Solicitud de prueba gratis', basic: '1', pro: '1', payg: '1' },
  { feature: 'Panel de analytics', basic: '—', pro: 'Proximamente', payg: '—' },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);

  async function handleCheckout(planKey: PlanKey) {
    setLoadingPlan(planKey);
    try {
      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planKey }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('[PRICING] Checkout error:', data.error);
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error('[PRICING] Checkout error:', err);
      setLoadingPlan(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans flex flex-col">
      <Navbar activePage={null} />

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="pt-20 pb-16 px-4 text-center">
          <p className="text-xs font-bold tracking-[0.3em] uppercase text-[#C0001E] mb-4">
            Precios
          </p>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-white leading-tight" style={{ letterSpacing: '-1px' }}>
            Planes para cada promotor
          </h1>
          <p className="mt-4 text-base text-[#9A9A9A] max-w-lg mx-auto">
            Encuentra peleadores, llena tu cartelera, y haz crecer tu negocio. Una solicitud de prueba gratis para empezar.
          </p>
        </section>

        {/* ── Pricing Cards ── */}
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`border p-8 flex flex-col ${
                  plan.highlight
                    ? 'border-[#C0001E] bg-[#0F0F0F]'
                    : 'border-[#2A2A2A] bg-[#0A0A0A]'
                }`}
              >
                {/* Badge */}
                {plan.highlight && (
                  <span className="self-start text-xs font-bold tracking-widest uppercase px-3 py-1 bg-[#C0001E] text-white mb-6">
                    Recomendado
                  </span>
                )}

                <p className="text-xs font-bold tracking-[0.3em] uppercase text-[#9A9A9A] mb-2">
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                </div>
                <p className="text-sm text-[#5A5A5A] mb-8">{plan.period}</p>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map(({ label, value }) => {
                    const isIncluded = value === true || (typeof value === 'string' && value !== '—');
                    return (
                      <li key={label} className="flex items-start gap-3">
                        {isIncluded ? (
                          <svg className="w-4 h-4 text-[#C0001E] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-[#3A3A3A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span className={`text-sm ${isIncluded ? 'text-white' : 'text-[#5A5A5A]'}`}>
                          {label}
                          {typeof value === 'string' && (
                            <span className="ml-1 text-[#9A9A9A]">— {value}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleCheckout(plan.planKey)}
                  disabled={loadingPlan !== null}
                  className={`w-full py-3 text-sm font-bold tracking-widest uppercase transition-colors disabled:opacity-50 ${
                    plan.highlight
                      ? 'bg-[#C0001E] text-white hover:bg-[#9A0018]'
                      : 'border border-[#3A3A3A] text-white hover:border-white'
                  }`}
                >
                  {loadingPlan === plan.planKey ? 'Procesando...' : plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Free trial note */}
          <p className="text-center text-xs text-[#5A5A5A] mt-8">
            Todos los planes incluyen 1 solicitud de prueba gratis. Sin tarjeta de credito.
          </p>
        </section>

        {/* ── Comparison Table ── */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <h2 className="text-2xl font-black uppercase text-white text-center mb-10" style={{ letterSpacing: '-0.5px' }}>
            Comparacion de planes
          </h2>
          <div className="border border-[#2A2A2A] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2A]">
                  <th className="text-left px-6 py-4 text-xs font-bold tracking-widest uppercase text-[#9A9A9A]">Caracteristica</th>
                  <th className="px-6 py-4 text-xs font-bold tracking-widest uppercase text-[#9A9A9A] text-center">Basic</th>
                  <th className="px-6 py-4 text-xs font-bold tracking-widest uppercase text-center">
                    <span className="text-[#C0001E]">Pro</span>
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-widest uppercase text-[#9A9A9A] text-center">Pay-as-you-go</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={i < COMPARISON.length - 1 ? 'border-b border-[#1A1A1A]' : ''}>
                    <td className="px-6 py-4 text-white font-medium">{row.feature}</td>
                    <td className="px-6 py-4 text-[#9A9A9A] text-center">{row.basic}</td>
                    <td className="px-6 py-4 text-white text-center font-semibold">{row.pro}</td>
                    <td className="px-6 py-4 text-[#9A9A9A] text-center">{row.payg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="border-t border-[#1A1A1A] py-20 px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black uppercase text-white mb-4" style={{ letterSpacing: '-1px' }}>
            Empieza a encontrar peleadores hoy
          </h2>
          <p className="text-sm text-[#9A9A9A] mb-8 max-w-md mx-auto">
            Tu primera solicitud es gratis. Sin compromisos.
          </p>
          <a
            href="/register"
            className="inline-block px-10 py-4 text-sm font-bold tracking-widest uppercase text-white bg-[#C0001E] hover:bg-[#9A0018] transition-colors"
          >
            Crear cuenta gratis
          </a>
        </section>
      </main>

      <Footer />
    </div>
  );
}
