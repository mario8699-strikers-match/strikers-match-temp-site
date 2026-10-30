import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { LocalizedText } from '@/components/LocalizedText';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Acerca de Strikers Match',
  description: 'Conoce la misión de Strikers Match y cómo conecta internacionalmente a atletas, entrenadores, gimnasios, organizadores y profesionales de los deportes de combate.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-zinc-900">
      <Navbar activePage={null} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#C0001E]">Strikers Match</p>
        <h1 className="font-display text-5xl font-black uppercase leading-none sm:text-7xl"><LocalizedText i18nKey="common.pages.about.title" /></h1>

        <div className="mt-10 space-y-8 text-base leading-relaxed text-zinc-700">
          <section>
            <h2 className="mb-3 text-2xl font-black uppercase text-zinc-950"><LocalizedText i18nKey="common.pages.about.communityTitle" /></h2>
            <p><LocalizedText i18nKey="common.pages.about.communityBody" /></p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-black uppercase text-zinc-950"><LocalizedText i18nKey="common.pages.about.missionTitle" /></h2>
            <p><LocalizedText i18nKey="common.pages.about.missionBody" /></p>
          </section>
          <section>
            <h2 className="mb-3 text-2xl font-black uppercase text-zinc-950"><LocalizedText i18nKey="common.pages.about.workTitle" /></h2>
            <p><LocalizedText i18nKey="common.pages.about.workBody" /></p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
