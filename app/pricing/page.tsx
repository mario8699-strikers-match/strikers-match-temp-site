'use client';

import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const FREE_GROUPS = [
  {
    title: 'Eventos',
    items: [
      'Crear y publicar eventos',
      'Editar información del evento',
      'Subir cartel del evento',
      'Registro de atletas',
      'Gestión de pagos manuales de inscripción',
    ],
  },
  {
    title: 'Matchmaking',
    items: [
      'Solicitudes de pelea',
      'Sugerencias de emparejamiento',
      'Validación por disciplina',
      'Revisión de compatibilidad',
      'Aprobación manual de combates',
    ],
  },
  {
    title: 'Operación',
    items: [
      'Combates',
      'Asignación de rings',
      'Orden de combates',
      'Centro de impresión',
      'Operación del evento',
      'Resultados',
    ],
  },
  {
    title: 'Paneles',
    items: [
      'Panel de promotor',
      'Panel de representante',
      'Estadísticas',
      'Equipo del evento',
      'Directorio público',
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] font-sans text-white">
      <Navbar activePage="pricing" />

      <main className="text-center">
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#C0001E]">Strikers Match</p>
          <h1 className="font-display text-5xl font-black uppercase leading-none sm:text-7xl">
            Herramientas de la plataforma
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-[#B5B5B5]">
            Funciones disponibles para crear eventos, registrar atletas, emparejar peleadores, administrar combates e imprimir hojas del evento.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <div className="border border-emerald-700/40 bg-emerald-900/10 p-6 sm:p-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-emerald-400">Disponible</p>
            <h2 className="mb-6 text-2xl font-black uppercase text-white">Funciones incluidas</h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {FREE_GROUPS.map((group) => (
                <div key={group.title} className="border border-emerald-800/30 bg-[#0A0A0A]/40 p-5">
                  <h3 className="mb-4 font-display text-2xl font-black uppercase text-white">{group.title}</h3>
                  <ul className="space-y-2 text-sm text-[#D5D5D5]">
                    {group.items.map((item) => (
                      <li key={item} className="border border-emerald-900/30 px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <div className="border border-[#3A3A3A] bg-[#151515] p-6 opacity-45 grayscale sm:p-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-[#9A9A9A]">Studio</p>
            <h2 className="font-display text-3xl font-black uppercase text-[#B5B5B5]">Próximamente</h2>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-[#9A9A9A]">
              Herramientas de producción para preparar cámaras locales, gráficos y operación de transmisión desde el evento.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/events"
              className="min-h-11 bg-[#C0001E] px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#9A0018]"
            >
              Ver eventos
            </Link>
            <Link
              href="/directorio"
              className="min-h-11 border border-[#3A3A3A] px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#1A1A1A]"
            >
              Ver Directorio
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
