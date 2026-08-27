import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Contacto',
  description: 'Contacta al equipo de Strikers Match para soporte, preguntas sobre cuentas, perfiles, eventos o el directorio de boxeo y MMA en México.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900">
      <Navbar activePage={null} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#C0001E]">Strikers Match</p>
        <h1 className="font-display text-5xl font-black uppercase leading-none sm:text-7xl">Contacto</h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-600">
          Para soporte, preguntas sobre tu cuenta, perfiles, eventos o el directorio, comunícate con el equipo de Strikers Match.
        </p>
        <a
          href="mailto:info@strikersmatch.com"
          className="mt-10 inline-flex min-h-11 items-center bg-[#C0001E] px-8 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#9A0018]"
        >
          info@strikersmatch.com
        </a>
      </main>
      <Footer />
    </div>
  );
}
