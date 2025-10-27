const express = require('express')
const brandAuthRouter = express.Router()
const brandAuthService = require('../../services/brandAuthService')

// POST /api/brand/register
brandAuthRouter.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body || {}
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required' })
        }

        const result = await brandAuthService.createBrandUser({
            email,
            name,
            password,
            deviceInfo: req.headers['user-agent'] || 'unknown'
        })

        if (!result.success) {
            return res.status(409).json(result) // USER EXISTS
        }

        return res.status(201).json(result) // Created
    } catch (error) {
        console.error('Error creating brand user:', error)

        // Handle specific database errors
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage.includes('username')) {
                return res.status(409).json({ success: false, message: 'Username already exists' })
            } else if (error.sqlMessage.includes('emailID')) {
                return res.status(409).json({ success: false, message: 'Email already exists' })
            } else if (error.sqlMessage.includes('uid')) {
                return res.status(409).json({ success: false, message: 'User ID already exists' })
            }
        }

        return res.status(500).json({ success: false, message: 'Server error' })
    }
})

// POST /api/brand/login
brandAuthRouter.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body || {}
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required' })
        }

        const result = await brandAuthService.loginBrandUser(
            email,
            password,
            req.headers['user-agent'] // device info
        )

        if (!result.success) {
            return res.status(401).json(result)
        }

        return res.status(200).json(result)
    } catch (error) {
        console.error('Brand login error:', error)

        // Handle specific database errors
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Duplicate entry error' })
        }

        return res.status(500).json({ success: false, message: 'Server error' })
    }
})

// POST /api/brand/refresh-token
brandAuthRouter.post('/refresh-token', async (req, res) => {
    try {
        const { refreshToken } = req.body || {}
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'Refresh token required' })
        }

        const result = await brandAuthService.refreshBrandToken(refreshToken)

        if (!result.success) {
            return res.status(401).json(result)
        }

        return res.status(200).json(result)
    } catch (error) {
        console.error('Brand refresh token error:', error)
        return res.status(500).json({ success: false, message: 'Server error' })
    }
})

module.exports = brandAuthRouter


