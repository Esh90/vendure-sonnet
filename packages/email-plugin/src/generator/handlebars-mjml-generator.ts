import dateFormat from 'dateformat';
import Handlebars from 'handlebars';

import { InitializedEmailPluginOptions } from '../types';

import { EmailGenerator } from './email-generator';

/**
 * @description
 * Uses Handlebars (https://handlebarsjs.com/) to output MJML (https://mjml.io) which is then
 * compiled down to responsive email HTML.
 *
 * Since v3.7 the `mjml` package is an optional peer dependency of `@vendure/email-plugin`.
 * If you use this generator (it is the default when no `emailGenerator` is supplied to
 * `EmailPlugin.init()`), install it explicitly:
 *
 * ```bash
 * npm install mjml
 * ```
 *
 * If you supply your own `emailGenerator` you do not need to install `mjml`.
 *
 * @docsCategory core plugins/EmailPlugin
 * @docsPage EmailGenerator
 */
export class HandlebarsMjmlGenerator implements EmailGenerator {
    private mjml2html: typeof import('mjml');

    async onInit(options: InitializedEmailPluginOptions) {
        try {
            this.mjml2html = require('mjml') as typeof import('mjml');
        } catch (e) {
            throw new Error(
                'The default HandlebarsMjmlGenerator requires the "mjml" package to be installed. ' +
                    'Install it with `npm install mjml`, or pass a different `emailGenerator` to ' +
                    '`EmailPlugin.init()`. Underlying error: ' +
                    (e instanceof Error ? e.message : String(e)),
            );
        }
        if (options.templateLoader.loadPartials) {
            const partials = await options.templateLoader.loadPartials();
            partials.forEach(({ name, content }) => Handlebars.registerPartial(name, content));
        }
        this.registerHelpers();
    }

    generate(from: string, subject: string, template: string, templateVars: any) {
        const compiledFrom = Handlebars.compile(from, { noEscape: true });
        const compiledSubject = Handlebars.compile(subject);
        const compiledTemplate = Handlebars.compile(template);
        // We enable prototype properties here, aware of the security implications
        // described here: https://handlebarsjs.com/api-reference/runtime-options.html#options-to-control-prototype-access
        // This is needed because some Vendure entities use getters on the entity
        // prototype (e.g. Order.total) which may need to be interpolated.
        const templateOptions: RuntimeOptions = { allowProtoPropertiesByDefault: true };
        const fromResult = compiledFrom(templateVars, templateOptions);
        const subjectResult = compiledSubject(templateVars, templateOptions);
        const mjml = compiledTemplate(templateVars, templateOptions);
        const body = this.mjml2html(mjml).html;
        return { from: fromResult, subject: subjectResult, body };
    }

    private registerHelpers() {
        Handlebars.registerHelper('formatDate', (date: Date | undefined, format: string | object) => {
            if (!date) {
                return date;
            }
            if (typeof format !== 'string') {
                format = 'default';
            }
            return dateFormat(date, format);
        });

        Handlebars.registerHelper(
            'formatMoney',
            (amount?: number, currencyCode?: string, locale?: string) => {
                if (amount == null) {
                    return amount;
                }
                // Last parameter is a generic "options" object which is not used here.
                // If it's supplied, it means the helper function did not receive the additional, optional parameters.
                // See https://handlebarsjs.com/api-reference/helpers.html#the-options-parameter
                if (!currencyCode || typeof currencyCode === 'object') {
                    return new Intl.NumberFormat(typeof locale === 'object' ? undefined : locale, {
                        style: 'decimal',
                    }).format(amount / 100);
                }
                // Same reasoning for `locale` as for `currencyCode` here.
                return new Intl.NumberFormat(typeof locale === 'object' ? undefined : locale, {
                    style: 'currency',
                    currency: currencyCode,
                }).format(amount / 100);
            },
        );
    }
}
