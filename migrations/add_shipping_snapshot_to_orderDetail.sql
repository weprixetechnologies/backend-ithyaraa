-- Snapshot shipping address fields directly on orderDetail.
-- This preserves the delivery address even if the user later edits or deletes
-- their saved address record.

ALTER TABLE orderDetail
    ADD COLUMN shippingName      VARCHAR(255)  DEFAULT NULL AFTER addressID,
    ADD COLUMN shippingPhone     VARCHAR(20)   DEFAULT NULL AFTER shippingName,
    ADD COLUMN shippingEmail     VARCHAR(255)  DEFAULT NULL AFTER shippingPhone,
    ADD COLUMN shippingLine1     VARCHAR(500)  DEFAULT NULL AFTER shippingEmail,
    ADD COLUMN shippingLine2     VARCHAR(500)  DEFAULT NULL AFTER shippingLine1,
    ADD COLUMN shippingCity      VARCHAR(100)  DEFAULT NULL AFTER shippingLine2,
    ADD COLUMN shippingState     VARCHAR(100)  DEFAULT NULL AFTER shippingCity,
    ADD COLUMN shippingPincode   VARCHAR(10)   DEFAULT NULL AFTER shippingState,
    ADD COLUMN shippingLandmark  VARCHAR(255)  DEFAULT NULL AFTER shippingPincode;

