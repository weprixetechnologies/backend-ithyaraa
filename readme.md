<!-- # IN ADD PRODUCT - CREATE CATEGORY SELECTION -->
# IN BACKEND - CHECK FOR THE FIELD NAMES FOR CATEGORY
# UPDATE THE COUNT ON THE CATEGORY
# OFFER ID TO BE PASSED
<!-- # IN BACKEND - ATTRIBUTE UPLOADS CAN GET DUPLICATE - CHECK BY ATTRIBUTE NAME WHETHER IT EXIST IF EXIST THEN ADD NEWLY ADDED VALUES  -->


<!-- DONE -->
<!-- # EDIT PRODUCT -->
<!-- # POST - EDITPRODUCT -->
<!-- # PRODUCT LIST WITH PAGINATION WITH BACKEND -->
<!-- # PRODUCT LIST WITH PAGINATION WITH FRONTEND -->

<!-- COUPONS -->
1. GET /all-coupons 
-- GET COUPONS FROM COUPONS TABLE
--with pagination
--- OPTIONAL FOR FILTER

2. POST /create-coupon
-- CREATE UNIQUE COUPON ID (SERVICE)
--- CHECK THAT COUPON DOES NOT EXIST
--- IF COUPON EXISTS THEN GENERATE NEW
-- INSERT THE REQ.BODY TO THE COUPONS TABLE
-- RESPOND

3. GET /detail/:couponID
-- GET COUPON DETAILS FROM COUPONS TABLE USING COUPON ID
-- RESPOND

4. PUT /edit-coupon/:couponID
-- UPDATE THE COUPON IN COUPONS TABLE
-- RESPOND

<!-- MAKE COMBO -->

1. POST make-combo/create-product
-- GENERATE a unique comboID
-- CHECK THE TYPE
-- IF(make_combo) then add the payload to the products table. {treat the data like normal product only while posting tto the products table just the type will be make_combo and the productID = comboID }
-- const {products} = req.body
-- products.products to be maped
--- for each product get its product id and add the complete product to the make_combo_items table with the comboID == this combo. to get the product details, get it from the products table using the productID. only store the productID, productName, featuredImage,categories, and pass the comboID
-- RESPOND
REQUIREMENT - WHILE CREATING PRODUCT AND SELECTING THE PRODUCTS NEED 'GET /products/all-product'

2. PUT make-combo/edit-product
-- get the data from body and the productID
-- update the product in the products table
-- reemove all the products from the make_combo_items where comboID matches
-- reupload the products in the make_combo_items

3.GET make-combo/:comboID
-- get the combo details from the make_combo table
-- get the products from the make_combo_items table
-- combine and respond

4. GET make-combo/all-combo
-- paginate + filters.
-- price can be passed as range between start and end.
-- sortby can be passed for regularPrice (ascending or descending)
-- pagination must work on all. for suppose the user requested for descending that is High to Low Price, set the regularPrice column to descending order and then fetch it with pagination logic.
-- filters except the columns(filters will be passed as same as the column name for examplec all-combo?name='productname'&productID='someid' that means there must be column named 'name' and 'productID') willl be:-
--- 1.  priceStart & priceEnd (to get the between values in regularPrice)
--- 2. sortBy = desc or asc (to sort the data by the regularPrice but dont skip the pagination)
-- RESPOND WITH THE data

5. DELETE make-combo/delete-combo/:comboID
-- delete the product from products table where productID = comboID
-- delete all the entries from the make-combo-items where comboID = comboID
-- responds status and count of deleted

<!-- COMBO BY ITHYARAA -->


1. POST combo/create-product
-- GENERATE UNIQUE COMBO ID
-- CHECK THE TYPE
-- IF(combo) then add the payload to the products table
-- const {products} = req.body
--- for each product get its product id and add the complete product to the combo_items table with the comboID == this combo
-- RESPOND
REQUIREMENT - WHILE CREATING PRODUCT AND SELECTING THE PRODUCTS NEED 'GET /products/all-product'

2. PUT combo/edit-product
-- get the data from body and the productID
-- update the product in the products table
-- remove all the products from the combo_item where comboID matches
-- reupload the products in the combo_items by mapping the req.body.products (array of strings of productIDs.)


3.GET combo/:comboID
-- get the combo details from the products table where productID = comboID
-- get the products from the combo_item table where comboID= comboID and just store the productID
--combine in like {
    ...productDetails,
    products : [this will be array of strings of productIDs]
}
-- respond
-- proper error handling
--proper error info 

4. GET combo/all-combo
-- paginate + filters.
-- price can be passed as range between start and end.
-- sortby can be passed for regularPrice (ascending or descending)
-- pagination must work on all. for suppose the user requested for descending that is High to Low Price, set the regularPrice column to descending order and then fetch it with pagination logic.
-- filters except the columns(filters will be passed as same as the column name for examplec all-combo?name='productname'&productID='someid' that means there must be column named 'name' and 'productID') willl be:-
--- 1.  priceStart & priceEnd (to get the between values in regularPrice)
--- 2. sortBy = desc or asc (to sort the data by the regularPrice but dont skip the pagination)
-- RESPOND WITH THE data

5. DELETE combo/delete-combo/:comboID
-- delete the product from products table where productID = comboID
-- delete all the entries from the combo-items where comboID = comboID
-- responds status and count of deleted


<!-- BRANDS -->

1. GET brands/all-brands
-- Paginate Logic
-- filters {optional}{if present in the params}
-- If no filters then directly query
-- use LIKE

2. PUT brands/edit-brands/:brandID
-- search the brandID
-- use the req.body to update the brand columns


3. POST brands/edit-brands/:brandID
-- {password} = req.body
-- search the brandID
-- hash the password
-- use the req.body to add to the brand columns

4. POST brands/login
-- {emailID, password} = req.body
-- check the emailID and decode the password and verify it from the brands table
-- generateTokens
-- create sessions
--- ACCESS TOKEN (30mins)
--- REFRESH TOKEN (7days)
-- respond with the GENERATED TOKENS.

5. GET brands/details/:brandID
-- search the brand by brandID
-- give the complete row data
-- respond

6. DELETE brands/delete/:brandID
-- delete the brand from the brandID where brandID = brandID
-- respond the status


<!-- USERS -->

1. GET user/all-user
-- Paginate Logic
-- filters {optional}{if present in the params}
-- If no filters then directly query
-- use LIKE

2. PUT user/edit-user/:userID
-- search the userID
-- use the req.body to update the user columns


3. POST user/edit-user/:userID
-- {password} = req.body
-- search the userID
-- hash the password
-- use the req.body to add to the user columns

4. POST user/login
-- {emailID, password} = req.body
-- check the emailID and decode the password and verify it from the user table
-- generateTokens
-- create sessions
--- ACCESS TOKEN (30mins)
--- REFRESH TOKEN (7days)
-- respond with the GENERATED TOKENS.

5. GET user/details/:userID
-- search the user by userID
-- give the complete row data
-- respond

6. DELETE user/delete/:userID
-- delete the user from the userID where userID = userID
-- respond the status

7. POST user/logout
-- in the param, userID
-- delete the session of the userID
FRONTEND : - remove the accessID & refreshToken from the sessionStorage or the localstorage or the cookies