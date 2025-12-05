# Affiliate Bank Account Implementation

## Overview
This implementation adds bank account management functionality to the affiliate payout system, allowing affiliates to add bank accounts that must be approved by admins before payouts can be processed.

## Database Changes

### 1. Create `affiliate_bank_accounts` Table
Run: `backend/create_affiliate_bank_accounts_table.sql`

**Key Features:**
- Stores bank account details for affiliates
- Status tracking: `pending`, `approved`, `rejected`
- Default account flag for quick payout selection
- Audit trail (submittedBy, approvedBy, rejectedBy)
- Optimized indexes for performance:
  - `idx_uid` - Fast user lookups
  - `idx_status` - Fast status filtering
  - `idx_uid_status` - Combined user + status queries
  - `idx_uid_default` - Fast default account lookup
  - `idx_uid_approved` - Fast approved account queries
- Unique constraint on (uid, accountNumber, ifscCode) to prevent duplicates

### 2. Update `affiliateTransactions` Table
Run: `backend/add_bank_account_to_affiliate_transactions.sql`

**Changes:**
- Adds `bankAccountID` column to link payouts to bank accounts
- Foreign key constraint with CASCADE DELETE
- Index for performance

## API Endpoints

### User Endpoints (Requires Authentication)

#### POST `/api/affiliate/bank-account`
Add a new bank account for payout.

**Request Body:**
```json
{
  "accountHolderName": "John Doe",
  "accountNumber": "1234567890",
  "ifscCode": "SBIN0001234",
  "bankName": "State Bank of India",
  "branchName": "Main Branch",
  "accountType": "savings",
  "panNumber": "ABCDE1234F",
  "gstin": "29ABCDE1234F1Z5",
  "address": "123 Main St",
  "isDefault": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bank account added successfully. It will be reviewed by admin.",
  "data": {
    "bankAccountID": 1
  }
}
```

#### GET `/api/affiliate/bank-accounts?includeRejected=false`
Get all bank accounts for the authenticated affiliate.

**Query Parameters:**
- `includeRejected` (optional): Include rejected accounts (default: false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "bankAccountID": 1,
      "accountHolderName": "John Doe",
      "accountNumber": "1234567890",
      "ifscCode": "SBIN0001234",
      "bankName": "State Bank of India",
      "status": "approved",
      "isDefault": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET `/api/affiliate/bank-account/:bankAccountID`
Get details of a specific bank account.

#### PUT `/api/affiliate/bank-account/set-default`
Set a bank account as default for payouts.

**Request Body:**
```json
{
  "bankAccountID": 1
}
```

#### DELETE `/api/affiliate/bank-account/:bankAccountID`
Delete a bank account (only pending/rejected accounts can be deleted).

### Admin Endpoints (Requires Admin Authentication)

#### GET `/api/affiliate/admin/bank-accounts?page=1&limit=10&status=pending&uid=USER123`
Get all bank account requests with pagination and filters.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter by status (`pending`, `approved`, `rejected`)
- `uid`: Filter by user ID

**Response:**
```json
{
  "success": true,
  "data": [...],
  "page": 1,
  "limit": 10,
  "total": 50,
  "totalPages": 5
}
```

#### PUT `/api/affiliate/admin/bank-account/:bankAccountID/approve`
Approve a bank account request.

**Response:**
```json
{
  "success": true,
  "message": "Bank account approved successfully",
  "data": {
    "bankAccountID": 1,
    "status": "approved"
  }
}
```

#### PUT `/api/affiliate/admin/bank-account/:bankAccountID/reject`
Reject a bank account request.

**Request Body:**
```json
{
  "rejectionReason": "Invalid IFSC code"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bank account rejected successfully",
  "data": {
    "bankAccountID": 1,
    "status": "rejected"
  }
}
```

## Business Logic

### Bank Account Addition
1. User submits bank account details
2. System validates:
   - Required fields (accountHolderName, accountNumber, IFSC, bankName)
   - IFSC format (11 characters)
   - Duplicate check (same uid + accountNumber + IFSC)
3. Account is created with `pending` status
4. If it's the first account or marked as default, it's set as default
5. Admin reviews and approves/rejects

### Default Account Logic
- First approved account automatically becomes default
- Only approved accounts can be set as default
- Setting a new default unsets previous default
- Default account is used for payouts

### Payout Request Enhancement
- **Requirement**: User must have at least one approved bank account
- **Default Account**: Payout uses the default bank account
- **Tracking**: `bankAccountID` is stored in `affiliateTransactions` for audit

### Account Deletion
- Only `pending` or `rejected` accounts can be deleted
- `approved` accounts cannot be deleted (for audit trail)
- If default account is deleted, system will use next available approved account

## Performance Optimizations

1. **Indexes**: Strategic indexes on frequently queried columns
   - User lookups: `idx_uid`
   - Status filtering: `idx_status`
   - Combined queries: `idx_uid_status`, `idx_uid_default`
   - Approved account queries: `idx_uid_approved`

2. **Query Optimization**:
   - LEFT JOINs only when needed
   - Indexed foreign keys
   - Efficient WHERE clauses

3. **Default Account Caching**:
   - Single query to get default account
   - Indexed lookup for fast retrieval

## Security Features

1. **User Isolation**: Users can only access their own bank accounts
2. **Admin Verification**: Only admins can approve/reject accounts
3. **Audit Trail**: Tracks who submitted, approved, or rejected accounts
4. **Validation**: IFSC format validation, duplicate prevention
5. **Status Protection**: Approved accounts cannot be deleted

## Migration Steps

1. Run `create_affiliate_bank_accounts_table.sql` to create the table
2. Run `add_bank_account_to_affiliate_transactions.sql` to add bankAccountID column
3. Restart the backend server to load new routes and controllers

## Testing Checklist

- [ ] Add bank account as affiliate
- [ ] View bank accounts list
- [ ] Set default bank account
- [ ] Admin view all bank account requests
- [ ] Admin approve bank account
- [ ] Admin reject bank account with reason
- [ ] Request payout (should require approved bank account)
- [ ] Verify bank account linked to payout transaction
- [ ] Delete pending/rejected account
- [ ] Attempt to delete approved account (should fail)
- [ ] Multiple bank accounts management

