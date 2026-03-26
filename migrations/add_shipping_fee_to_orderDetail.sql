ALTER TABLE orderDetail 
ADD COLUMN shippingFee DECIMAL(10,2) DEFAULT 0.00 AFTER couponDiscount;
