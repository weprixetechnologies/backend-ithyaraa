# PhonePe Webhook Troubleshooting Guide

## Problem: Webhooks are not being called by PhonePe

If webhooks are not being received, follow these steps:

## 1. Verify Webhook URL is Accessible

Test if your webhook endpoint is accessible from the internet:

```bash
# Test GET endpoint
curl https://backend.ithyaraa.com/api/phonepe/webhook/test

# Test POST endpoint (simulate webhook)
curl -X POST https://backend.ithyaraa.com/api/phonepe/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

Both should return success responses.

## 2. Check Server Logs

Look for these log entries when a payment is made:

```
[ORDER] PhonePe callback URL: https://backend.ithyaraa.com/api/phonepe/webhook/order
[ORDER] PhonePe API Response: {...}
```

After payment, check for:
```
[WEBHOOK-ORDER] ============================================
[WEBHOOK-ORDER] Webhook received at: ...
```

**If you see the first logs but NOT the second logs**, PhonePe is not calling your webhook.

## 3. PhonePe Dashboard Configuration

### IMPORTANT: PhonePe may require webhook URLs to be configured in their merchant dashboard

1. **Login to PhonePe Merchant Dashboard**
2. **Navigate to Settings → Webhooks** (or similar section)
3. **Add/Configure Webhook URLs:**
   - Order Webhook: `https://backend.ithyaraa.com/api/phonepe/webhook/order`
   - Presale Webhook: `https://backend.ithyaraa.com/api/phonepe/webhook/presale`
4. **Enable Webhook Notifications**
5. **Save the configuration**

### Note: Some PhonePe accounts require webhook URLs to be whitelisted
- Contact PhonePe support to whitelist your webhook URLs
- Provide them with your webhook URLs and merchant ID

## 4. Verify Callback URL in Payment Request

Check server logs for the callback URL being sent to PhonePe:

```
[ORDER] Callback URL being sent to PhonePe: https://backend.ithyaraa.com/api/phonepe/webhook/order
```

**Ensure:**
- URL is HTTPS (PhonePe requires HTTPS)
- URL is publicly accessible (not 192.168.1.12)
- URL has no trailing slashes
- URL matches exactly what's configured in PhonePe dashboard

## 5. Check PhonePe Webhook Delivery Logs

1. **Login to PhonePe Merchant Dashboard**
2. **Navigate to Transactions → Webhook Logs** (or similar)
3. **Check for:**
   - Webhook delivery attempts
   - HTTP status codes (should be 200)
   - Error messages if webhook failed

## 6. Common Issues

### Issue 1: Webhook URL not whitelisted
**Solution:** Contact PhonePe support to whitelist your webhook URLs

### Issue 2: SSL Certificate Issues
**Solution:** Ensure your SSL certificate is valid and trusted

### Issue 3: Firewall blocking PhonePe IPs
**Solution:** Whitelist PhonePe IP ranges (contact PhonePe for IP ranges)

### Issue 4: Webhook URL returns error
**Solution:** Test webhook endpoint manually and fix any errors

### Issue 5: PhonePe not configured for webhooks
**Solution:** Some PhonePe accounts require explicit webhook configuration in dashboard

## 7. Testing Webhook Manually

You can test if your webhook endpoint works by sending a test request:

```bash
curl -X POST https://backend.ithyaraa.com/api/phonepe/webhook/order \
  -H "Content-Type: application/json" \
  -H "X-VERIFY: test-signature" \
  -d '{
    "merchantID": "test-123",
    "code": "PAYMENT_SUCCESS",
    "state": "COMPLETED"
  }'
```

Check server logs to see if the webhook handler receives the request.

## 8. Alternative: Use Polling (Current Workaround)

Since recheck is working, you can use polling as a workaround:

- Frontend polls `/api/phonepe/order/:orderId/status` every few seconds
- This checks PhonePe Status API directly (which is working)
- Updates payment status when payment completes

This is already implemented in the order status page.

## 9. Contact PhonePe Support

If webhooks still don't work after checking all above:

1. **Contact PhonePe Support**
2. **Provide:**
   - Your Merchant ID
   - Webhook URLs you're using
   - Sample transaction IDs
   - Screenshots of webhook configuration in dashboard
3. **Ask them to:**
   - Verify webhook configuration for your account
   - Check webhook delivery logs
   - Whitelist your webhook URLs if needed

## 10. Verify Environment Variables

Ensure these are set correctly:

```env
BACKEND_URL=https://backend.ithyaraa.com
FRONTEND_URL=https://backend.ithyaraa.com
MERCHANT_ID=your_merchant_id
KEY=your_salt_key
KEY_INDEX=1
NODE_ENV=production
```

## Summary

**Most Common Cause:** PhonePe requires webhook URLs to be configured/whitelisted in their merchant dashboard, not just sent in the payment request.

**Quick Check:**
1. ✅ Webhook endpoint accessible? → Test with curl
2. ✅ Callback URL in logs? → Check server logs
3. ✅ Webhook received? → Check for `[WEBHOOK-ORDER]` logs
4. ✅ PhonePe dashboard configured? → Check webhook settings
5. ✅ Contact PhonePe support? → If still not working

