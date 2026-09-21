-- Fix NULL brand and brandID for admin, combo, and make_combo products

UPDATE products
SET 
    brandID = COALESCE(NULLIF(brandID, ''), 'inhouse'),
    brand = COALESCE(NULLIF(brand, ''), 'In-house Brand')
WHERE 
    (type IN ('combo', 'make_combo') OR brandID IS NULL OR brandID = '' OR LOWER(brandID) = 'inhouse')
    AND (brandID IS NULL OR brand IS NULL OR brandID = '' OR brand = '');

UPDATE order_items
SET brandID = 'inhouse'
WHERE (brandID IS NULL OR brandID = '' OR LOWER(brandID) = 'inhouse');
