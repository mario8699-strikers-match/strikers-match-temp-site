'use client';

/* eslint-disable @next/next/no-img-element -- uploaded event artwork is served from project storage */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoutGraphic as BoutGraphicPreview } from '@/components/BoutGraphic';
import { EventManageFrame } from '@/components/EventManageFrame';
import { downloadBoutGraphic } from '@/lib/boutGraphicSvg';
import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { canUseEventFeature } from '@/services/eventStaffService';
import { eventService } from '@/services/eventService';
import { advanceGuidedOnboarding } from '@/services/onboardingService';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  getEventDisplayState,
  getEventGraphics,
  getEventGraphicsSettings,
  reviewBoutGraphic,
  saveEventGraphicsSettings,
  setEventDisplay,
  uploadEventGraphicImage,
} from '@/services/graphicsService';
import type { BoutGraphic, Event, EventDisplayState, EventGraphicsSettings, Profile } from '@/types';

type GraphicsForm = Omit<EventGraphicsSettings, 'event_id' | 'created_at' | 'updated_at'>;

export default function EventGraphicsPage() {
  const { t } = useTranslation('events');
  const { id: eventId } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [event, setEvent] = useState<Event | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [graphics, setGraphics] = useState<BoutGraphic[]>([]);
  const [settings, setSettings] = useState<GraphicsForm>(DEFAULT_GRAPHICS_SETTINGS);
  const [state, setState] = useState<EventDisplayState | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [sponsorFiles, setSponsorFiles] = useState<File[]>([]);
  const [displayPreviewIndex, setDisplayPreviewIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [graphicsResult, settingsResult, stateResult] = await Promise.all([
      getEventGraphics(eventId), getEventGraphicsSettings(eventId), getEventDisplayState(eventId),
    ]);
    const nextError = graphicsResult.error ?? settingsResult.error ?? stateResult.error;
    if (nextError) setError(nextError);
    setGraphics(graphicsResult.data ?? []);
    if (settingsResult.data) {
      setSettings({
        template_key: settingsResult.data.template_key,
        template_version: settingsResult.data.template_version,
        primary_color: settingsResult.data.primary_color,
        secondary_color: settingsResult.data.secondary_color,
        accent_color: settingsResult.data.accent_color,
        logo_url: settingsResult.data.logo_url,
        background_url: settingsResult.data.background_url,
        sponsor_logo_urls: settingsResult.data.sponsor_logo_urls,
        display_duration_seconds: settingsResult.data.display_duration_seconds,
      });
    }
    setState(stateResult.data ?? null);
  }, [eventId]);

  useEffect(() => {
    let active = true;
    Promise.all([authService.getSession(), eventService.getById(eventId)]).then(async ([sessionResult, eventResult]) => {
      if (!active) return;
      const nextProfile = sessionResult.data?.profile ?? null;
      const nextEvent = eventResult.data ?? null;
      setProfile(nextProfile);
      setEvent(nextEvent);
      const allowed = (await canUseEventFeature(eventId, 'matchmaking', nextProfile, nextEvent)) || (await canUseEventFeature(eventId, 'production', nextProfile, nextEvent));
      setCanManage(allowed);
      if (allowed) await reload();
      setLoading(false);
    });
    return () => { active = false; };
  }, [eventId, reload]);

  useEffect(() => {
    if (!canManage) return;
    const channel = supabase
      .channel(`event-graphics:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bout_graphics', filter: `event_id=eq.${eventId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_display_state', filter: `event_id=eq.${eventId}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [canManage, eventId, reload]);

  const saveSettings = async () => {
    setActing('settings'); setError(null); setMessage(null);
    const nextSettings = { ...settings };

    const logoResult = logoFile ? await uploadEventGraphicImage(eventId, logoFile, 'logo') : null;
    if (logoResult?.error) { setError(logoResult.error); setActing(null); return; }
    if (logoResult?.data) nextSettings.logo_url = logoResult.data;

    const backgroundResult = backgroundFile ? await uploadEventGraphicImage(eventId, backgroundFile, 'background') : null;
    if (backgroundResult?.error) { setError(backgroundResult.error); setActing(null); return; }
    if (backgroundResult?.data) nextSettings.background_url = backgroundResult.data;

    const uploadedSponsorUrls: string[] = [];
    for (const file of sponsorFiles) {
      const result = await uploadEventGraphicImage(eventId, file, 'sponsor');
      if (result.error || !result.data) { setError(result.error ?? t('events.engine.graphicsPage.sponsorUploadError')); setActing(null); return; }
      uploadedSponsorUrls.push(result.data);
    }
    nextSettings.sponsor_logo_urls = [...nextSettings.sponsor_logo_urls, ...uploadedSponsorUrls];

    const result = await saveEventGraphicsSettings(eventId, nextSettings);
    if (result.error) {
      setError(result.error);
    } else {
      setLogoFile(null);
      setBackgroundFile(null);
      setSponsorFiles([]);
      setSettings(nextSettings);
      setMessage(t('events.engine.graphicsPage.designSaved'));
      await reload();
    }
    setActing(null);
  };

  const review = async (graphic: BoutGraphic, action: 'approve' | 'publish' | 'return_to_draft') => {
    setActing(graphic.id); setError(null); setMessage(null);
    const result = await reviewBoutGraphic(graphic.id, action);
    if (result.error) setError(result.error); else {
      setMessage(action === 'publish' ? t('events.engine.graphicsPage.published') : t('events.engine.graphicsPage.statusUpdated'));
      if (action === 'publish' && profile && !profile.onboarding_completed && !profile.onboarding_dismissed
        && profile.onboarding_event_id === eventId && profile.onboarding_step <= 8) {
        const advancement = await advanceGuidedOnboarding(8, eventId, true);
        if (advancement.data) setProfile(advancement.data);
      }
    }
    await reload(); setActing(null);
  };

  const showGraphic = async (graphicId: string | null, mode: 'manual' | 'sequence', isLive = true) => {
    setActing('display'); setError(null);
    const result = await setEventDisplay(eventId, graphicId, mode, isLive);
    if (result.error) setError(result.error); else setMessage(isLive ? t('events.engine.graphicsPage.displayUpdated') : t('events.engine.graphicsPage.displayStopped'));
    await reload(); setActing(null);
  };

  const publishedGraphics = useMemo(() => graphics.filter((graphic) => graphic.status === 'published'), [graphics]);
  useEffect(() => {
    if (!state?.is_live || state.mode !== 'sequence' || publishedGraphics.length < 2) return;
    const timer = window.setInterval(
      () => setDisplayPreviewIndex((index) => (index + 1) % publishedGraphics.length),
      Math.max(3, settings.display_duration_seconds) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [publishedGraphics.length, settings.display_duration_seconds, state?.is_live, state?.mode]);

  const activeDisplayGraphic = useMemo(() => {
    if (!state?.is_live || publishedGraphics.length === 0) return null;
    if (state.mode === 'sequence') return publishedGraphics[displayPreviewIndex % publishedGraphics.length];
    return publishedGraphics.find((graphic) => graphic.id === state.active_graphic_id) ?? null;
  }, [displayPreviewIndex, publishedGraphics, state]);

  if (loading || profile === undefined) return <Frame><p className="text-sm text-zinc-500">{t('events.engine.graphicsPage.loading')}</p></Frame>;
  if (!canManage) return <Frame><h1 className="text-3xl font-black uppercase">{t('events.engine.graphicsPage.graphics')}</h1><p className="mt-3 text-sm text-zinc-600">{t('events.engine.graphicsPage.noPermission')}</p></Frame>;

  return <Frame>
    <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C0001E]">Strikers Match</p><h1 className="mt-2 text-4xl font-black uppercase sm:text-5xl">{t('events.engine.graphicsPage.title')}</h1><p className="mt-2 text-sm text-zinc-600">{event?.event_name}</p></div>
      <div className="grid grid-cols-2 gap-2"><Link href={`/events/${eventId}/manage/bouts`} className="flex min-h-11 items-center justify-center border border-zinc-300 px-4 text-xs font-bold uppercase">{t('events.engine.bouts.title')}</Link><Link href={`/events/${eventId}/manage/matchmaking`} className="flex min-h-11 items-center justify-center border border-zinc-300 px-4 text-xs font-bold uppercase">{t('events.engine.matchmaking.title')}</Link></div>
    </header>
    {error && <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

    <section className="border border-zinc-200 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-black uppercase">{t('events.engine.graphicsPage.eventDesign')}</h2><p className="mt-1 text-sm text-zinc-500">{t('events.engine.graphicsPage.designHelp')}</p></div><button type="button" onClick={saveSettings} disabled={acting === 'settings'} className="min-h-11 bg-zinc-900 px-5 text-xs font-bold uppercase text-white disabled:bg-zinc-300">{acting === 'settings' ? t('events.engine.graphicsPage.saving') : t('events.engine.graphicsPage.saveDesign')}</button></div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GraphicsField label={t('events.engine.graphicsPage.template')} value={settings.template_key} onChange={(value) => setSettings({ ...settings, template_key: value })} />
        <GraphicsField label={t('events.engine.graphicsPage.primaryColor')} type="color" value={settings.primary_color} onChange={(value) => setSettings({ ...settings, primary_color: value })} />
        <GraphicsField label={t('events.engine.graphicsPage.textColor')} type="color" value={settings.secondary_color} onChange={(value) => setSettings({ ...settings, secondary_color: value })} />
        <GraphicsField label={t('events.engine.graphicsPage.accentColor')} type="color" value={settings.accent_color} onChange={(value) => setSettings({ ...settings, accent_color: value })} />
        <GraphicsField label={t('events.engine.graphicsPage.duration')} type="number" value={String(settings.display_duration_seconds)} onChange={(value) => setSettings({ ...settings, display_duration_seconds: Math.max(3, Number(value) || 12) })} />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ImageUploadField
          label={t('events.engine.graphicsPage.eventLogo')}
          help={t('events.engine.graphicsPage.imageHelp')}
          currentUrl={settings.logo_url}
          file={logoFile}
          onSelect={setLogoFile}
          onRemove={() => { setLogoFile(null); setSettings({ ...settings, logo_url: null }); }}
        />
        <ImageUploadField
          label={t('events.engine.graphicsPage.graphicBackground')}
          help={t('events.engine.graphicsPage.backgroundHelp')}
          currentUrl={settings.background_url}
          file={backgroundFile}
          onSelect={setBackgroundFile}
          onRemove={() => { setBackgroundFile(null); setSettings({ ...settings, background_url: null }); }}
        />
        <SponsorUploadField
          currentUrls={settings.sponsor_logo_urls}
          files={sponsorFiles}
          onSelect={setSponsorFiles}
          onRemoveCurrent={(url) => setSettings({ ...settings, sponsor_logo_urls: settings.sponsor_logo_urls.filter((item) => item !== url) })}
          onRemoveFile={(file) => setSponsorFiles(sponsorFiles.filter((item) => item !== file))}
        />
      </div>
    </section>

    <section className="border border-zinc-200 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-black uppercase">{t('events.engine.graphicsPage.eventDisplay')}</h2><p className="mt-1 text-sm text-zinc-500">{t('events.engine.graphicsPage.displayHelp')}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => showGraphic(null, 'sequence')} disabled={publishedGraphics.length === 0 || acting === 'display'} className="min-h-11 bg-[#C0001E] px-4 text-xs font-bold uppercase text-white disabled:bg-zinc-300">{t('events.engine.graphicsPage.automaticSequence')}</button><button type="button" onClick={() => showGraphic(null, 'manual', false)} disabled={acting === 'display'} className="min-h-11 border border-zinc-300 px-4 text-xs font-bold uppercase disabled:text-zinc-300">{t('events.engine.graphicsPage.stop')}</button><Link href={`/events/${eventId}/display`} className="flex min-h-11 items-center justify-center border border-zinc-900 bg-zinc-900 px-4 text-xs font-bold uppercase text-white">{t('events.engine.graphicsPage.openDisplayMode')}</Link></div></div>
      <p className="mt-3 text-xs text-zinc-500">{t('events.engine.graphicsPage.displayStatus', { status: state?.is_live ? t('events.engine.graphicsPage.activeMode', { mode: state.mode }) : t('events.engine.graphicsPage.stopped'), revision: state?.revision ?? 0 })}</p>
      <div className="mt-4 overflow-hidden bg-black">
        {activeDisplayGraphic
          ? <BoutGraphicPreview payload={activeDisplayGraphic.payload} variant="screen" className="w-full" />
          : <div className="flex aspect-video items-center justify-center p-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-white/60">{publishedGraphics.length === 0 ? t('events.engine.graphicsPage.publishToDisplay') : t('events.engine.graphicsPage.displayStopped')}</div>}
      </div>
    </section>

    <section className="border border-zinc-200 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black uppercase">{t('events.engine.graphicsPage.officialBrackets')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{t('events.engine.graphicsPage.officialBracketsHelp')}</p>
        </div>
        <Link href={`/events/${eventId}/manage/print?view=officials`} className="flex min-h-11 shrink-0 items-center justify-center bg-zinc-950 px-5 text-center text-xs font-bold uppercase text-white">{t('events.engine.graphicsPage.openOfficialBrackets')}</Link>
      </div>
    </section>

    <section><div className="flex items-baseline justify-between"><h2 className="text-2xl font-black uppercase">{t('events.engine.bouts.title')}</h2><span className="text-sm text-zinc-500">{t('events.engine.graphicsPage.graphicCount', { count: graphics.length })}</span></div><div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">{graphics.length === 0 ? <p className="border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 lg:col-span-2">{t('events.engine.graphicsPage.noGraphics')}</p> : graphics.map((graphic) => <article key={graphic.id} className="border border-zinc-200 bg-white p-4"><BoutGraphicPreview payload={graphic.payload} /><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-black uppercase">{t('events.engine.graphicsPage.boutNumber', { number: graphic.payload.bout.number ?? t('events.engine.graphicsPage.unnumbered') })}</p><p className="text-xs text-zinc-500">{t('events.engine.graphicsPage.templateVersion', { status: graphic.status, version: graphic.template_version })}</p></div><div className="flex flex-wrap gap-2">{graphic.status === 'draft' || graphic.status === 'stale' ? <SmallButton label={t('events.engine.graphicsPage.approve')} disabled={acting === graphic.id} onClick={() => review(graphic, 'approve')} /> : null}{graphic.status === 'approved' ? <SmallButton label={t('events.engine.graphicsPage.publish')} primary disabled={acting === graphic.id} onClick={() => review(graphic, 'publish')} /> : null}{graphic.status === 'published' ? <SmallButton label={t('events.engine.graphicsPage.show')} primary disabled={acting === 'display'} onClick={() => showGraphic(graphic.id, 'manual')} /> : null}<SmallButton label={t('events.engine.graphicsPage.screenSvg')} disabled={false} onClick={() => downloadBoutGraphic(graphic.payload, 'screen')} /><SmallButton label={t('events.engine.graphicsPage.socialSvg')} disabled={false} onClick={() => downloadBoutGraphic(graphic.payload, 'social')} />{graphic.status !== 'draft' && <SmallButton label={t('events.engine.graphicsPage.draft')} disabled={acting === graphic.id} onClick={() => review(graphic, 'return_to_draft')} />}</div></div></article>)}</div></section>
  </Frame>;
}

function GraphicsField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label><span className="mb-1 block text-xs font-bold uppercase text-zinc-600">{label}</span><input type={type} min={type === 'number' ? 3 : undefined} value={value} onChange={(input) => onChange(input.target.value)} className="min-h-11 w-full border border-zinc-300 bg-white px-3 text-sm" /></label>; }

function ImageUploadField({ label, help, currentUrl, file, onSelect, onRemove }: { label: string; help: string; currentUrl: string | null; file: File | null; onSelect: (file: File | null) => void; onRemove: () => void }) {
  const { t } = useTranslation('events');
  return <div className="border border-zinc-200 p-3"><p className="text-xs font-bold uppercase text-zinc-700">{label}</p><p className="mt-1 text-xs text-zinc-500">{help}</p>{currentUrl && !file ? <img src={currentUrl} alt={label} className="mt-3 h-24 w-full bg-zinc-100 object-contain" /> : null}{file ? <p className="mt-3 break-all bg-zinc-50 p-3 text-xs font-medium text-zinc-700">{t('events.engine.graphicsPage.selectedFile', { name: file.name })}</p> : null}<label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center bg-zinc-900 px-3 text-center text-xs font-bold uppercase text-white"><span>{file || currentUrl ? t('events.engine.graphicsPage.changeImage') : t('events.engine.graphicsPage.uploadImage')}</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onClick={(input) => { input.currentTarget.value = ''; }} onChange={(input) => onSelect(input.target.files?.[0] ?? null)} /></label>{file || currentUrl ? <button type="button" onClick={onRemove} className="mt-2 min-h-10 w-full border border-red-200 px-3 text-xs font-bold uppercase text-red-700">{t('events.engine.graphicsPage.removeImage')}</button> : null}</div>;
}

function SponsorUploadField({ currentUrls, files, onSelect, onRemoveCurrent, onRemoveFile }: { currentUrls: string[]; files: File[]; onSelect: (files: File[]) => void; onRemoveCurrent: (url: string) => void; onRemoveFile: (file: File) => void }) {
  const { t } = useTranslation('events');
  return <div className="border border-zinc-200 p-3"><p className="text-xs font-bold uppercase text-zinc-700">{t('events.engine.graphicsPage.sponsorLogos')}</p><p className="mt-1 text-xs text-zinc-500">{t('events.engine.graphicsPage.sponsorHelp')}</p>{currentUrls.length > 0 ? <div className="mt-3 grid grid-cols-2 gap-2">{currentUrls.map((url) => <div key={url} className="border border-zinc-200 p-2"><img src={url} alt={t('events.engine.graphicsPage.sponsorLogo')} className="h-14 w-full object-contain" /><button type="button" onClick={() => onRemoveCurrent(url)} className="mt-1 min-h-8 w-full text-[10px] font-bold uppercase text-red-700">{t('events.engine.graphicsPage.remove')}</button></div>)}</div> : null}{files.length > 0 ? <div className="mt-3 space-y-1">{files.map((file) => <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 bg-zinc-50 px-2 py-2 text-xs"><span className="min-w-0 truncate">{file.name}</span><button type="button" onClick={() => onRemoveFile(file)} className="font-bold uppercase text-red-700">{t('events.engine.graphicsPage.remove')}</button></div>)}</div> : null}<label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center bg-zinc-900 px-3 text-center text-xs font-bold uppercase text-white"><span>{t('events.engine.graphicsPage.uploadLogos')}</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onClick={(input) => { input.currentTarget.value = ''; }} onChange={(input) => onSelect(Array.from(input.target.files ?? []))} /></label></div>;
}

function SmallButton({ label, onClick, disabled, primary = false }: { label: string; onClick: () => void; disabled: boolean; primary?: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className={`min-h-10 px-3 text-xs font-bold uppercase disabled:bg-zinc-200 ${primary ? 'bg-[#C0001E] text-white' : 'border border-zinc-300 text-zinc-700'}`}>{label}</button>; }
function Frame({ children }: { children: React.ReactNode }) { return <EventManageFrame>{children}</EventManageFrame>; }
