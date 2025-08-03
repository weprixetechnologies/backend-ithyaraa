## USER MANAGEMENT ##

# GET USER DETAIL FOR ADMIN
 PAYLOAD : UID
 1. Search 'user' from users WHERE UID == UID.
 2. Fetch the data - Respond in JSON

# UPDATE USER DETAIL
 PAYLOAD : JSON
 1. PARSE THE JSON and update the user in db
 2. Respond with STATUS.

 # GET ALL THE USERS (CURSOR-BASED PAGINATION)
 PAYLOAD: (LIMIT, FILTERS, PAGE)
 1. PARSE limit, filters, and page from the payload.
 2. CALCULATE offset using:
 3. offset = (page - 1) * limit
 4. QUERY the users table/collection WHERE filters match.
 5. APPLY LIMIT and OFFSET to fetch paginated users.
 6. RETURN the user data in JSON with metadata (e.g., totalCount, currentPage).


export const users = {
    username: 'Ankit Saha',
    emailID: 'rseditz57@gmail.com',
    phonenumber: '7439398783',
    lastLogin: '12 Apr 2025',
    deviceInfo: [],
    joinedOn: '',
    verifiedEmail: '',
    verifiedPhone: '',
    uid: '',
    balance: ''
}



