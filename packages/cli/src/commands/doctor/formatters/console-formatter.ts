import { log } from '@clack/prompts';
import pc from 'picocolors';

import { CheckStatus, DoctorReport } from '../types';

const STATUS_LABELS: Record<CheckStatus, string> = {
    pass: pc.green('pass'),
    warn: pc.yellow('warn'),
    fail: pc.red('fail'),
    skip: pc.dim('skip'),
};

/**
 * Formats the doctor report for terminal output using @clack/prompts and picocolors.
 */
export function formatConsoleReport(report: DoctorReport): void {
    console.log('');
    log.info(pc.bold('Vendure Doctor'));
    console.log('');

    for (const check of report.checks) {
        const status = STATUS_LABELS[check.status];
        const name = check.name.padEnd(16);
        log.info(`${name}${status}  ${check.message}`);

        if (check.details?.length) {
            for (const detail of check.details) {
                log.info(pc.dim(`                  ${detail}`));
            }
        }
    }

    console.log('');
    const failCount = report.checks.filter(c => c.status === 'fail').length;
    const warnCount = report.checks.filter(c => c.status === 'warn').length;

    if (report.overallStatus === 'failed') {
        const parts: string[] = [];
        if (failCount > 0) parts.push(`${failCount} failure${failCount > 1 ? 's' : ''}`);
        if (warnCount > 0) parts.push(`${warnCount} warning${warnCount > 1 ? 's' : ''}`);
        log.error(`Result: ${pc.red('failed')} (${parts.join(', ')})`);
    } else {
        const msg = warnCount > 0
            ? `Result: ${pc.green('passed')} (${warnCount} warning${warnCount > 1 ? 's' : ''})`
            : `Result: ${pc.green('passed')}`;
        log.success(msg);
    }
}
