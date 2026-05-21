import { Writable } from 'stream';
import { describe, expect, it } from 'vitest';

import { ProgressBar } from './progress-bar';

function captureStream(): { stream: Writable; output: () => string } {
    const chunks: string[] = [];
    const stream = new Writable({
        write(chunk, _encoding, callback) {
            chunks.push(chunk.toString());
            callback();
        },
    });
    return { stream, output: () => chunks.join('') };
}

/**
 * Strips the in-place redraw control sequence (`\r\x1B[2K`) so assertions
 * can focus on the rendered content, not the terminal-control bytes that
 * make it overwrite-in-place.
 */
function strip(output: string): string {
    return output.replace(/\r\x1B\[2K/g, '');
}

describe('ProgressBar', () => {
    it('interpolates :current and :total tokens', () => {
        const { stream, output } = captureStream();
        const bar = new ProgressBar(':current/:total', { total: 5, stream, renderThrottle: 0 });
        bar.tick();
        bar.tick();
        expect(strip(output())).toContain('2/5');
    });

    it('interpolates :percent', () => {
        const { stream, output } = captureStream();
        const bar = new ProgressBar(':percent', { total: 4, stream, renderThrottle: 0 });
        bar.tick();
        expect(strip(output())).toContain('25%');
    });

    it('renders the :bar token with configurable complete/incomplete characters', () => {
        const { stream, output } = captureStream();
        const bar = new ProgressBar('[:bar]', {
            total: 4,
            width: 8,
            complete: '#',
            incomplete: '.',
            stream,
            renderThrottle: 0,
        });
        bar.tick(); // 1/4 → 25% → 2 of 8 complete chars
        expect(strip(output())).toContain('[##......]');
    });

    it('interpolates custom tokens passed via tick({...})', () => {
        const { stream, output } = captureStream();
        const bar = new ProgressBar('Importing :prodName (:current/:total)', {
            total: 3,
            stream,
            renderThrottle: 0,
        });
        bar.tick({ prodName: 'Widget' });
        expect(strip(output())).toContain('Importing Widget (1/3)');
    });

    it('advances by a numeric delta when tick(n) is passed', () => {
        const { stream, output } = captureStream();
        const bar = new ProgressBar(':current/:total', { total: 10, stream, renderThrottle: 0 });
        bar.tick(3);
        bar.tick(2);
        expect(strip(output())).toContain('5/10');
    });

    it('emits a newline once the bar reaches completion', () => {
        const { stream, output } = captureStream();
        const bar = new ProgressBar(':percent', { total: 2, stream, renderThrottle: 0 });
        bar.tick();
        bar.tick();
        expect(output().endsWith('\n')).toBe(true);
        expect(strip(output())).toContain('100%');
    });

    it('ignores ticks after completion (idempotent on overshoot)', () => {
        const { stream, output } = captureStream();
        const bar = new ProgressBar(':current/:total', { total: 2, stream, renderThrottle: 0 });
        bar.tick();
        bar.tick();
        const afterComplete = output();
        bar.tick();
        expect(output()).toBe(afterComplete);
    });

    it('throttles intermediate renders but always emits the completion frame', () => {
        // The first tick always renders (lastRender starts at 0, so the
        // throttle window has effectively "elapsed"). Subsequent ticks within
        // the throttle window are suppressed. Once `current` reaches `total`,
        // the completion frame must render regardless of throttling so the
        // user sees the final 100% state.
        const { stream, output } = captureStream();
        const bar = new ProgressBar(':current/:total', {
            total: 3,
            stream,
            renderThrottle: 1_000_000,
        });
        bar.tick(); // First frame always renders.
        const afterFirst = output();
        expect(strip(afterFirst)).toContain('1/3');

        bar.tick(); // Throttled out — no new content.
        expect(output()).toBe(afterFirst);

        bar.tick(); // Reaches total → completion frame renders unthrottled.
        expect(strip(output())).toContain('3/3');
    });

    it('renders the Vendure Importer-shape format string correctly', () => {
        // The format string used by packages/core/.../importer.ts:85
        const { stream, output } = captureStream();
        const bar = new ProgressBar('  importing [:bar] :percent :etas  Importing: :prodName', {
            total: 4,
            width: 4,
            complete: '=',
            incomplete: ' ',
            stream,
            renderThrottle: 0,
        });
        bar.tick({ prodName: 'Sample Product' });
        const out = strip(output());
        expect(out).toContain('importing');
        expect(out).toContain('[=   ]');
        expect(out).toContain('25%');
        expect(out).toContain('Importing: Sample Product');
    });
});
