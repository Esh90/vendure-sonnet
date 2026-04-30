/**
 * Shared locale-profile data and helpers.
 *
 * Single source of truth for which scripts each locale's msgstrs are
 * expected to use, what counts as a "foreign" script intrusion, and
 * common helpers (PO parsing, trivial-string detection). Imported by
 * `audit-translations.js`, `i18n-tool.js` and `spot-check.js` so the
 * three scripts can't drift.
 *
 * If you add support for a new locale, update the relevant tables here.
 */

import fs from 'node:fs';

// ---------------------------------------------------------------------------
// Script ranges & expectations
// ---------------------------------------------------------------------------

/**
 * Unicode script-range matchers used to detect foreign-script intrusion
 * in any locale. Each value is a regex that matches a single character
 * belonging to that script.
 */
export const SCRIPT_RANGES = {
    arabic: /[؀-ۿݐ-ݿﭐ-﷿]/,
    hebrew: /[֐-׿]/,
    cyrillic: /[Ѐ-ӿ]/,
    cjk: /[一-鿿]/,
    hiragana: /[぀-ゟ]/,
    katakana: /[゠-ヿ]/,
    hangul: /[가-힣]/,
    devanagari: /[ऀ-ॿ]/,
    greek: /[Ͱ-Ͽ]/,
};

/**
 * For each non-Latin locale, the set of scripts whose presence in a
 * msgstr is ALLOWED (essentially the locale's own native script(s)).
 * Any character in a script not on this list is "foreign" and should
 * be flagged.
 *
 * Locales not listed here are Latin-script locales and accept any
 * Latin-range characters; they're flagged only on non-Latin intrusion.
 */
export const ALLOWED_SCRIPTS = {
    ar: ['arabic'],
    fa: ['arabic'],
    he: ['hebrew'],
    ru: ['cyrillic'],
    bg: ['cyrillic'],
    uk: ['cyrillic'],
    zh_Hans: ['cjk'],
    zh_Hant: ['cjk'],
    ja: ['cjk', 'hiragana', 'katakana'],
    ko: ['hangul', 'cjk'],
    ne: ['devanagari'],
};

/**
 * For each non-Latin locale, the script whose presence is REQUIRED
 * (every substantive msgstr must contain at least one character from
 * this script).
 *
 * Latin-script locales are absent from this table — we have no
 * guaranteed character signal to look for, so we don't enforce one.
 */
export const REQUIRED_SCRIPTS = {
    ar: { name: 'Arabic', test: c => SCRIPT_RANGES.arabic.test(c) },
    fa: { name: 'Persian/Arabic', test: c => SCRIPT_RANGES.arabic.test(c) },
    he: { name: 'Hebrew', test: c => SCRIPT_RANGES.hebrew.test(c) },
    ru: { name: 'Cyrillic', test: c => SCRIPT_RANGES.cyrillic.test(c) },
    bg: { name: 'Cyrillic', test: c => SCRIPT_RANGES.cyrillic.test(c) },
    uk: { name: 'Cyrillic', test: c => SCRIPT_RANGES.cyrillic.test(c) },
    zh_Hans: { name: 'CJK', test: c => SCRIPT_RANGES.cjk.test(c) },
    zh_Hant: { name: 'CJK', test: c => SCRIPT_RANGES.cjk.test(c) },
    ja: {
        name: 'Japanese (Hira/Kana/CJK)',
        test: c => SCRIPT_RANGES.hiragana.test(c) || SCRIPT_RANGES.katakana.test(c) || SCRIPT_RANGES.cjk.test(c),
    },
    ko: { name: 'Hangul', test: c => SCRIPT_RANGES.hangul.test(c) },
    ne: { name: 'Devanagari', test: c => SCRIPT_RANGES.devanagari.test(c) },
};

// ---------------------------------------------------------------------------
// Trivial-string filtering
// ---------------------------------------------------------------------------

/**
 * Returns true if a msgstr is too short / too symbolic to carry a
 * reliable language signal. Used by both the heuristic auditor and the
 * apply-time guard so they treat the same strings as "skip".
 *
 * Things considered trivial:
 *   - shorter than 3 chars total
 *   - <2 letter characters once whitespace, digits, punctuation and
 *     ASCII placeholder syntax are stripped
 *   - composed entirely of ICU-placeholder syntax with no word ≥ 4 letters
 */
export function looksTrivial(s) {
    if (!s || s.length < 3) return true;
    // Strip whitespace, digits, all Unicode punctuation/symbols
    const stripped = s.replace(/[\s\d\p{P}\p{S}]/gu, '');
    if (stripped.length < 2) return true;
    // Looks like a pure placeholder string ("{count}", "%s", "{0} of {1}")?
    if (/^[\s{}\d%a-zA-Z_,\-]*$/.test(s) && !/[a-z]{4,}/i.test(s)) return true;
    return false;
}

// ---------------------------------------------------------------------------
// PO parsing
// ---------------------------------------------------------------------------

/**
 * Parse a .po file into structured entries.
 *
 *   { msgid, msgstr, msgstrLine, refs }
 *
 * The msgstrLine is 1-based to match what most editors and `cat -n`
 * show. The header entry (empty msgid) is skipped. Multi-line msgid /
 * msgstr (continuation `"..."` lines) are concatenated.
 */
export function parsePOFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const entries = [];

    let i = 0;
    while (i < lines.length) {
        const refs = [];
        while (i < lines.length && !lines[i].startsWith('msgid ')) {
            if (lines[i].startsWith('#:')) refs.push(lines[i].slice(2).trim());
            i++;
        }
        if (i >= lines.length) break;

        let msgid = unquote(lines[i].slice(6));
        i++;
        while (i < lines.length && lines[i].startsWith('"')) {
            msgid += unquote(lines[i]);
            i++;
        }

        if (i >= lines.length || !lines[i].startsWith('msgstr ')) continue;
        const msgstrLine = i + 1;
        let msgstr = unquote(lines[i].slice(7));
        i++;
        while (i < lines.length && lines[i].startsWith('"')) {
            msgstr += unquote(lines[i]);
            i++;
        }

        if (msgid === '') continue;
        entries.push({ msgid, msgstr, msgstrLine, refs });
    }

    return entries;
}

function unquote(s) {
    s = s.trim();
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
    return s
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
}
