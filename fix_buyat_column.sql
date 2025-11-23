-- Fix buyAt column to allow NULL values for buy_x_get_y offers
ALTER TABLE offers MODIFY COLUMN buyAt INT(11) NULL DEFAULT NULL;

