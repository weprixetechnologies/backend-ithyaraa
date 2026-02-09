/**
 * Sanitize HTML for FAQ answer_html - allow only safe tags and attributes.
 * Prevents XSS while preserving basic formatting.
 */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'span'];
const ALLOWED_ATTRS = { a: ['href', 'target', 'rel'] };

function sanitizeHtml(html) {
    if (typeof html !== 'string') return '';
    // Strip script, style, iframe, object, etc.
    let out = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
    // Allow only listed tags; strip others (keep text)
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    out = out.replace(tagRegex, (match, tagName) => {
        const lower = tagName.toLowerCase();
        if (!ALLOWED_TAGS.includes(lower)) return '';
        if (match.startsWith('</')) return `</${lower}>`;
        const attrRegex = /\s+([a-zA-Z][a-zA-Z0-9]*)\s*=\s*["']([^"']*)["']/g;
        let attrs = '';
        let m;
        const allowed = ALLOWED_ATTRS[lower];
        if (allowed) {
            while ((m = attrRegex.exec(match)) !== null) {
                if (allowed.includes(m[1].toLowerCase())) {
                    let v = m[2];
                    if (m[1].toLowerCase() === 'href') v = v.replace(/^javascript:/i, '');
                    attrs += ` ${m[1]}="${v.replace(/"/g, '&quot;')}"`;
                }
            }
        }
        return `<${lower}${attrs}>`;
    });
    return out.trim();
}

module.exports = { sanitizeHtml };
