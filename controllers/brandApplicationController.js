const brandApplicationModel = require('../model/brandApplicationModel');
const brandService = require('../services/brandService');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Generate a unique reference ID: ITH-APP-YYYY-XXXX
 */
const generateRefId = async () => {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 10; attempt++) {
        const num = String(Math.floor(1000 + Math.random() * 9000));
        const refId = `ITH-APP-${year}-${num}`;
        const existing = await brandApplicationModel.getApplicationByRefId(refId);
        if (!existing) return refId;
    }
    // fallback with timestamp suffix
    return `ITH-APP-${year}-${Date.now()}`;
};

/**
 * Generate a temporary password for the brand account
 */
const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

// ─────────────────────────────────────────────
// Public endpoint — Submit Application
// ─────────────────────────────────────────────

const submitApplication = async (req, res) => {
    try {
        const {
            brandName,
            website,
            productType,
            address,
            interests,
            partnershipType,
            dropshipStatus,
            monthlyOrderVolume,
            goals,
            lookbookName,
            lookbookUrl,
            contactName,
            contactPosition,
            contactEmail,
            contactPhone,
            consent,
        } = req.body;

        // Basic validation
        if (!brandName || !website || !address || !contactName || !contactEmail || !contactPhone) {
            return res.status(400).json({
                success: false,
                message: 'Required fields are missing: brandName, website, address, contactName, contactEmail, contactPhone',
            });
        }

        if (!interests || !Array.isArray(interests) || interests.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one collaboration interest must be selected',
            });
        }

        if (!consent) {
            return res.status(400).json({
                success: false,
                message: 'Consent is required to submit the application',
            });
        }

        // Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contactEmail)) {
            return res.status(400).json({ success: false, message: 'Invalid email address' });
        }

        const refId = await generateRefId();

        await brandApplicationModel.createApplication({
            ref_id: refId,
            brand_name: brandName,
            website,
            product_type: productType || 'fashion',
            address,
            interests,
            partnership_type: partnershipType || null,
            dropship_status: dropshipStatus || 'no',
            monthly_order_volume: monthlyOrderVolume || null,
            goals: goals || null,
            lookbook_name: lookbookName || null,
            lookbook_url: lookbookUrl || null,
            contact_name: contactName,
            contact_position: contactPosition || null,
            contact_email: contactEmail,
            contact_phone: contactPhone,
            consent: !!consent,
        });

        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            refId,
        });
    } catch (error) {
        console.error('Submit brand application error:', error);
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

// ─────────────────────────────────────────────
// Admin — List Applications
// ─────────────────────────────────────────────

const listApplications = async (req, res) => {
    try {
        const { status } = req.query;
        const validStatuses = ['pending', 'approved', 'rejected'];
        const filter = validStatuses.includes(status) ? status : null;

        const applications = await brandApplicationModel.getAllApplications(filter);

        // Parse JSON fields stored as strings in MySQL
        const parsed = applications.map((app) => ({
            ...app,
            interests: typeof app.interests === 'string' ? JSON.parse(app.interests) : app.interests,
            partnership_type: app.partnership_type
                ? (typeof app.partnership_type === 'string' ? JSON.parse(app.partnership_type) : app.partnership_type)
                : null,
        }));

        return res.status(200).json({ success: true, data: parsed, total: parsed.length });
    } catch (error) {
        console.error('List brand applications error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch applications' });
    }
};

// ─────────────────────────────────────────────
// Admin — Get Single Application Detail
// ─────────────────────────────────────────────

const getApplicationDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const app = await brandApplicationModel.getApplicationById(id);

        if (!app) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Parse JSON fields
        app.interests = typeof app.interests === 'string' ? JSON.parse(app.interests) : app.interests;
        app.partnership_type = app.partnership_type
            ? (typeof app.partnership_type === 'string' ? JSON.parse(app.partnership_type) : app.partnership_type)
            : null;

        return res.status(200).json({ success: true, data: app });
    } catch (error) {
        console.error('Get brand application detail error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch application' });
    }
};

// ─────────────────────────────────────────────
// Admin — Approve Application → Create Brand Account
// ─────────────────────────────────────────────

const approveApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body || {};
        const reviewedBy = req.user?.username || req.user?.email || 'admin';

        const app = await brandApplicationModel.getApplicationById(id);

        if (!app) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        if (app.status === 'approved') {
            return res.status(409).json({
                success: false,
                message: 'This application has already been approved',
                brandUid: app.brand_uid,
            });
        }

        // Generate temporary password
        const tempPassword = generateTempPassword();

        // Create brand user account using existing service
        const createResult = await brandService.createBrandUser({
            email: app.contact_email,
            name: app.brand_name,
            password: tempPassword,
            gstin: null,
            profilePhoto: null,
            shippingCharge: 0,
            deviceInfo: 'Admin Approval — Brand Onboarding',
        });

        if (!createResult.success) {
            return res.status(409).json({
                success: false,
                message: createResult.message || 'Failed to create brand account',
            });
        }

        const brandUid = createResult.data?.uid || createResult.uid;

        // Mark application as approved
        await brandApplicationModel.updateApplicationStatus(id, 'approved', reviewedBy, brandUid, notes || null);

        return res.status(200).json({
            success: true,
            message: 'Application approved. Brand account created.',
            data: {
                brandUid,
                brandEmail: app.contact_email,
                tempPassword,
            },
        });
    } catch (error) {
        console.error('Approve brand application error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'A brand account already exists for this email address',
            });
        }
        return res.status(500).json({ success: false, message: 'Failed to approve application' });
    }
};

// ─────────────────────────────────────────────
// Admin — Reject Application
// ─────────────────────────────────────────────

const rejectApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body || {};
        const reviewedBy = req.user?.username || req.user?.email || 'admin';

        const app = await brandApplicationModel.getApplicationById(id);

        if (!app) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        if (app.status === 'approved') {
            return res.status(409).json({
                success: false,
                message: 'Cannot reject an already-approved application',
            });
        }

        await brandApplicationModel.updateApplicationStatus(id, 'rejected', reviewedBy, null, notes || null);

        return res.status(200).json({ success: true, message: 'Application rejected' });
    } catch (error) {
        console.error('Reject brand application error:', error);
        return res.status(500).json({ success: false, message: 'Failed to reject application' });
    }
};

module.exports = {
    submitApplication,
    listApplications,
    getApplicationDetail,
    approveApplication,
    rejectApplication,
};
