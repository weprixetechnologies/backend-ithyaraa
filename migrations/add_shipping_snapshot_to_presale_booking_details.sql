-- Snapshot shipping address fields directly on presale_booking_details.
-- This ensures presale bookings always retain the delivery address used
-- at the time of booking.

ALTER TABLE presale_booking_details
    ADD COLUMN shippingName      VARCHAR(255)  DEFAULT NULL,
    ADD COLUMN shippingPhone     VARCHAR(20)   DEFAULT NULL,
    ADD COLUMN shippingEmail     VARCHAR(255)  DEFAULT NULL,
    ADD COLUMN shippingLine1     VARCHAR(500)  DEFAULT NULL,
    ADD COLUMN shippingLine2     VARCHAR(500)  DEFAULT NULL,
    ADD COLUMN shippingCity      VARCHAR(100)  DEFAULT NULL,
    ADD COLUMN shippingState     VARCHAR(100)  DEFAULT NULL,
    ADD COLUMN shippingPincode   VARCHAR(10)   DEFAULT NULL,
    ADD COLUMN shippingLandmark  VARCHAR(255)  DEFAULT NULL;

