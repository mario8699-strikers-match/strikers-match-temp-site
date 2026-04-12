/**
 * ============================================
 *  DEV-ONLY TEST PAGE — REMOVE BEFORE PRODUCTION
 * ============================================
 *
 * Admin-only page to seed test data and run the
 * promoter → fight request → paywall validation flow.
 */
'use client';

import { useState } from 'react';
import { seedTestData, runTestFlow, type TestFlowResult } from '@/lib/testSeed';

type SeedStatus = 'idle' | 'running' | 'done' | 'error';
type FlowStatus = 'idle' | 'running' | 'done' | 'error';

export default function TestFlowPage() {
  const [seedStatus, setSeedStatus] = useState<SeedStatus>('idle');
  const [seedLog, setSeedLog] = useState<string[]>([]);
  const [seedErrors, setSeedErrors] = useState<string[]>([]);

  const [flowStatus, setFlowStatus] = useState<FlowStatus>('idle');
  const [flowResult, setFlowResult] = useState<TestFlowResult | null>(null);

  // ── Seed handler ──
  async function handleSeed() {
    setSeedStatus('running');
    setSeedLog([]);
    setSeedErrors([]);
    try {
      const res = await seedTestData();
      setSeedLog(res.log);
      setSeedErrors(res.errors);
      setSeedStatus(res.success ? 'done' : 'error');
    } catch (err) {
      setSeedErrors([err instanceof Error ? err.message : String(err)]);
      setSeedStatus('error');
    }
  }

  // ── Test flow handler ──
  async function handleRunFlow() {
    setFlowStatus('running');
    setFlowResult(null);
    try {
      const res = await runTestFlow();
      setFlowResult(res);
      setFlowStatus(res.errors.length === 0 ? 'done' : 'error');
    } catch (err) {
      setFlowResult({
        first_request: 'failed',
        second_request: 'error',
        paywall_triggered: false,
        fighter_attempt: 'skipped',
        log: [],
        errors: [err instanceof Error ? err.message : String(err)],
      });
      setFlowStatus('error');
    }
  }

  // ── Result badge color ──
  function badge(pass: boolean) {
    return pass
      ? 'bg-green-100 text-green-800 border-green-300'
      : 'bg-red-100 text-red-800 border-red-300';
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">Test Flow Validator</h1>
        <p className="text-sm text-zinc-500 mt-1">
          DEV ONLY — Seed data + validate promoter paywall flow. Remove before production.
        </p>
      </div>

      {/* ── PART 1: Seed Data ── */}
      <section className="mb-10">
        <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wide mb-3">
          1 — Seed Test Data
        </h2>
        <p className="text-xs text-zinc-500 mb-3">
          Creates promoter@test.com, fighter@test.com, 15 fighters, and 1 test event.
        </p>
        <button
          onClick={handleSeed}
          disabled={seedStatus === 'running'}
          className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          {seedStatus === 'running' ? 'Seeding...' : 'Run Seed'}
        </button>

        {seedLog.length > 0 && (
          <div className="mt-4 bg-zinc-50 border border-zinc-200 p-4 max-h-60 overflow-y-auto">
            {seedLog.map((line, i) => (
              <p key={i} className="text-xs font-mono text-zinc-600">{line}</p>
            ))}
          </div>
        )}
        {seedErrors.length > 0 && (
          <div className="mt-2 bg-red-50 border border-red-200 p-3">
            {seedErrors.map((e, i) => (
              <p key={i} className="text-xs font-mono text-red-700">{e}</p>
            ))}
          </div>
        )}
      </section>

      {/* ── PART 2: Run Test Flow ── */}
      <section className="mb-10">
        <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wide mb-3">
          2 — Run Test Flow
        </h2>
        <p className="text-xs text-zinc-500 mb-3">
          Promoter login → fetch fighters → send 1st request (expect: success) → send 2nd request (expect: blocked) → fighter access check.
        </p>
        <button
          onClick={handleRunFlow}
          disabled={flowStatus === 'running'}
          className="px-4 py-2 bg-brand-red text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#E53935' }}
        >
          {flowStatus === 'running' ? 'Running...' : 'Run Test Flow'}
        </button>

        {/* Results card */}
        {flowResult && (
          <div className="mt-6 border border-zinc-200 bg-white">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
              <h3 className="text-sm font-bold text-zinc-800">Results</h3>
            </div>
            <div className="p-4 space-y-3">
              {/* Row: First request */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">1st Fight Request</span>
                <span className={`text-xs font-bold px-2 py-0.5 border rounded ${badge(flowResult.first_request === 'success')}`}>
                  {flowResult.first_request === 'success' ? 'SUCCESS ✓' : 'FAILED ✗'}
                </span>
              </div>
              {/* Row: Second request */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">2nd Fight Request (paywall)</span>
                <span className={`text-xs font-bold px-2 py-0.5 border rounded ${badge(flowResult.second_request === 'blocked')}`}>
                  {flowResult.second_request === 'blocked' ? 'BLOCKED ✓' : flowResult.second_request.toUpperCase() + ' ✗'}
                </span>
              </div>
              {/* Row: Paywall triggered */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Paywall Triggered</span>
                <span className={`text-xs font-bold px-2 py-0.5 border rounded ${badge(flowResult.paywall_triggered)}`}>
                  {flowResult.paywall_triggered ? 'YES ✓' : 'NO ✗'}
                </span>
              </div>
              {/* Row: Fighter blocked */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Fighter Cannot Send Requests</span>
                <span className={`text-xs font-bold px-2 py-0.5 border rounded ${badge(flowResult.fighter_attempt === 'blocked')}`}>
                  {flowResult.fighter_attempt === 'blocked' ? 'BLOCKED ✓' : flowResult.fighter_attempt.toUpperCase() + ' ✗'}
                </span>
              </div>
            </div>

            {/* Log */}
            {flowResult.log.length > 0 && (
              <div className="border-t border-zinc-100 p-4">
                <p className="text-xs font-bold text-zinc-500 mb-2 uppercase">Execution Log</p>
                <div className="bg-zinc-50 border border-zinc-200 p-3 max-h-60 overflow-y-auto">
                  {flowResult.log.map((line, i) => (
                    <p key={i} className="text-xs font-mono text-zinc-600">{line}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {flowResult.errors.length > 0 && (
              <div className="border-t border-zinc-100 p-4">
                <p className="text-xs font-bold text-red-600 mb-2 uppercase">Errors</p>
                <div className="bg-red-50 border border-red-200 p-3">
                  {flowResult.errors.map((e, i) => (
                    <p key={i} className="text-xs font-mono text-red-700">{e}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
