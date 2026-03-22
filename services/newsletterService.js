const jwt = require('jsonwebtoken');
const newsletterModel = require('../model/newsletterModel');
const { addSendEmailJob } = require('../queue/emailProducer');
const usersModel = require('../model/usersModel');

const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 100;

function normalizeLimit(limit) {
    const n = Number(limit) || DEFAULT_PAGE_LIMIT;
    return Math.min(Math.max(n, 1), MAX_PAGE_LIMIT);
}

function normalizePage(page) {
    const p = Number(page) || 1;
    return Math.max(p, 1);
}

function buildUnsubscribeToken(payload) {
    const secret = process.env.JWT_SECRET || 'newsletter_unsub_secret';
    return jwt.sign(payload, secret, { expiresIn: '30d' });
}

function verifyUnsubscribeToken(token) {
    const secret = process.env.JWT_SECRET || 'newsletter_unsub_secret';
    return jwt.verify(token, secret);
}

function buildUnsubscribeLink(subscriberId, email) {
    const token = buildUnsubscribeToken({ sid: subscriberId, email });
    const baseUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:7885';
    return `${baseUrl.replace(/\/+$/, '')}/unsubscribe-newsletter/${token}`;
}

async function subscribe({ name, email }) {
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedName = String(name || '').trim();

    if (!trimmedName) {
        throw new Error('Name is required');
    }
    if (!trimmedEmail) {
        throw new Error('Email is required');
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
        throw new Error('Invalid email format');
    }

    // Basic domain validation (non-disposable heuristic only)
    const domain = trimmedEmail.split('@')[1] || '';
    if (!domain.includes('.')) {
        throw new Error('Invalid email domain');
    }

    const existing = await newsletterModel.findSubscriberByEmail(trimmedEmail);

    // Simple rate limiting per email: block re-subscribe within 60 seconds
    if (existing && existing.created_at) {
        const createdAt = new Date(existing.created_at).getTime();
        const now = Date.now();
        if (now - createdAt < 60 * 1000) {
            const err = new Error('Too many subscription attempts. Please try again later.');
            err.statusCode = 429;
            throw err;
        }
    }

    const id = await newsletterModel.createSubscriber({
        name: trimmedName,
        email: trimmedEmail
    });

    const subscriber = await newsletterModel.findSubscriberByEmail(trimmedEmail);

    // Also mark the corresponding user as joined to the newsletter (if present)
    try {
        await usersModel.setNewsletterJoinedByEmail(trimmedEmail, true);
    } catch (err) {
        console.error('Failed to update user.newsletter_joined flag:', err);
    }

    return {
        id: subscriber?.id || id,
        name: subscriber?.name || trimmedName,
        email: trimmedEmail,
        status: subscriber?.status || 'active'
    };
}

async function getSubscriptionStatus({ email }) {
    // For anonymous calls (no email provided), safely report as not subscribed.
    if (!email) {
        return { subscribed: false };
    }
    const trimmedEmail = String(email).trim().toLowerCase();
    const subscriber = await newsletterModel.findSubscriberByEmail(trimmedEmail);
    if (!subscriber) {
        return { subscribed: false, email: trimmedEmail };
    }
    return {
        subscribed: subscriber.status === 'active',
        status: subscriber.status,
        email: subscriber.email,
        name: subscriber.name
    };
}

async function unsubscribe({ token }) {
    if (!token) {
        const err = new Error('Token is required');
        err.statusCode = 400;
        throw err;
    }
    const decoded = verifyUnsubscribeToken(token);
    const subscriberId = decoded.sid;
    const email = decoded.email;

    if (!subscriberId || !email) {
        const err = new Error('Invalid unsubscribe token');
        err.statusCode = 400;
        throw err;
    }

    await newsletterModel.updateSubscriberStatusById(subscriberId, 'unsubscribed');

    // Also mark corresponding user as not joined to newsletter anymore
    try {
        await usersModel.setNewsletterJoinedByEmail(email, false);
    } catch (err) {
        console.error('Failed to clear user.newsletter_joined flag on unsubscribe:', err);
    }

    return {
        success: true
    };
}

async function unsubscribeByEmail({ email }) {
    const trimmedEmail = String(email || '').trim().toLowerCase();
    if (!trimmedEmail) {
        const err = new Error('Email is required');
        err.statusCode = 400;
        throw err;
    }

    const subscriber = await newsletterModel.findSubscriberByEmail(trimmedEmail);
    if (subscriber) {
        await newsletterModel.updateSubscriberStatusById(subscriber.id, 'unsubscribed');
    }

    try {
        await usersModel.setNewsletterJoinedByEmail(trimmedEmail, false);
    } catch (err) {
        console.error('Failed to clear user.newsletter_joined flag on email unsubscribe:', err);
    }

    return { success: true };
}

async function listPublicNewsletters({ page = 1, limit = DEFAULT_PAGE_LIMIT }) {
    const normalizedLimit = normalizeLimit(limit);
    const normalizedPage = normalizePage(page);
    const offset = (normalizedPage - 1) * normalizedLimit;

    return newsletterModel.listPublicNewsletters({
        limit: normalizedLimit,
        offset
    });
}

// Admin-side services

async function adminListSubscribers({ status, search, page = 1, limit = 50 }) {
    const normalizedLimit = normalizeLimit(limit);
    const normalizedPage = normalizePage(page);
    const offset = (normalizedPage - 1) * normalizedLimit;

    return newsletterModel.listSubscribers({
        status,
        search,
        limit: normalizedLimit,
        offset
    });
}

async function adminListNewsletters({ page = 1, limit = 20 }) {
    const normalizedLimit = normalizeLimit(limit);
    const normalizedPage = normalizePage(page);
    const offset = (normalizedPage - 1) * normalizedLimit;

    return newsletterModel.listAllNewsletters({
        limit: normalizedLimit,
        offset
    });
}

async function adminCreateNewsletter({ title, content_html, content_text, status, scheduled_at, created_by }) {
    if (!title || !content_html) {
        throw new Error('Title and HTML content are required');
    }
    const id = await newsletterModel.createNewsletter({
        title,
        content_html,
        content_text,
        status: status || 'draft',
        scheduled_at,
        created_by
    });
    const newsletter = await newsletterModel.getNewsletterById(id);
    return newsletter;
}

async function adminSendNewsletter({ newsletterId, retryFailedOnly = false }) {
    const newsletter = await newsletterModel.getNewsletterById(newsletterId);
    if (!newsletter) {
        const err = new Error('Newsletter not found');
        err.statusCode = 404;
        throw err;
    }

    // Fetch target recipients
    const batchSize = 1000;

    if (retryFailedOnly) {
        const failedDeliveries = await newsletterModel.getFailedDeliveries(newsletterId, batchSize);
        for (const delivery of failedDeliveries) {
            const unsubscribeLink = buildUnsubscribeLink(delivery.id, delivery.email);
            await addSendEmailJob({
                to: delivery.email,
                templateName: 'newsletter',
                variables: {
                    name: delivery.name,
                    title: newsletter.title,
                    contentHtml: newsletter.content_html,
                    contentText: newsletter.content_text || '',
                    unsubscribeLink
                },
                subject: newsletter.title,
                newsletterId,
                deliveryId: delivery.id
            });
        }
        return { enqueued: failedDeliveries.length, totalSubscribers: failedDeliveries.length };
    }

    let offset = 0;
    let totalEnqueued = 0;

    // Batch through active subscribers
    // and create deliveries + enqueue email jobs
    // until batch returns empty
    // This is safe up to 1M+ subscribers with proper batch size.
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const subscribers = await newsletterModel.getActiveSubscribersBatch({
            limit: batchSize,
            offset
        });
        if (!subscribers.length) {
            break;
        }

        for (const subscriber of subscribers) {
            const deliveryId = await newsletterModel.createDelivery(newsletterId, subscriber.id);
            const unsubscribeLink = buildUnsubscribeLink(subscriber.id, subscriber.email);

            await addSendEmailJob({
                to: subscriber.email,
                templateName: 'newsletter',
                variables: {
                    name: subscriber.name,
                    title: newsletter.title,
                    contentHtml: newsletter.content_html,
                    contentText: newsletter.content_text || '',
                    unsubscribeLink
                },
                subject: newsletter.title,
                newsletterId,
                deliveryId
            });
            totalEnqueued += 1;
        }

        offset += batchSize;
    }

    await newsletterModel.updateNewsletterStatusAndSentAt(newsletterId, 'sent');

    return {
        totalEnqueued
    };
}

async function adminGetNewsletterStats({ newsletterId }) {
    const newsletter = await newsletterModel.getNewsletterById(newsletterId);
    if (!newsletter) {
        const err = new Error('Newsletter not found');
        err.statusCode = 404;
        throw err;
    }
    const stats = await newsletterModel.getNewsletterStats(newsletterId);
    return {
        newsletter,
        stats
    };
}

module.exports = {
    subscribe,
    getSubscriptionStatus,
    unsubscribe,
    unsubscribeByEmail,
    listPublicNewsletters,
    adminListSubscribers,
    adminListNewsletters,
    adminCreateNewsletter,
    adminSendNewsletter,
    adminGetNewsletterStats
};

