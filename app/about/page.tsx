import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Acerca de Strikers Match',
  description: 'Conoce la misión de Strikers Match y cómo conecta a atletas, entrenadores, gimnasios, organizadores y profesionales del boxeo y MMA en México.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900">
      <Navbar activePage={null} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#C0001E]">Strikers Match</p>
        <h1 className="font-display text-5xl font-black uppercase leading-none sm:text-7xl">Acerca de nosotros</h1>

        <div className="mt-10 space-y-8 text-base leading-relaxed text-zinc-700">
          <section>
            <h2 className="mb-3 text-2xl font-black uppercase text-zinc-950">La comunidad del combate, conectada</h2>
            <p>
              Strikers Match es una plataforma mexicana creada para conectar a la comunidad del boxeo y las artes marciales mixtas: atletas, entrenadores, gimnasios, representantes, promotores, patrocinadores y profesionales de eventos.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-black uppercase text-zinc-950">Nuestra misión</h2>
            <p>
              Buscamos hacer más sencilla la forma de encontrar peleas, publicar eventos, completar carteleras y localizar los servicios necesarios para operar un evento de deportes de combate en México.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-black uppercase text-zinc-950">Qué hacemos</h2>
            <p>
              La plataforma ofrece perfiles públicos, directorios, herramientas de registro, matchmaking y operación de eventos. Strikers Match proporciona la tecnología para facilitar conexiones; no actúa como promotor, organizador, entrenador ni organismo sancionador.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
