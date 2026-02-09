-- Review images for product reviews
-- Non-breaking migration: separate table, FK to reviews.reviewID

CREATE TABLE IF NOT EXISTS review_images (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reviewID BIGINT UNSIGNED NOT NULL,
    imageUrl TEXT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_images_review
        FOREIGN KEY (reviewID) REFERENCES reviews(reviewID)
        ON DELETE CASCADE,
    INDEX idx_review_images_reviewID (reviewID),
    INDEX idx_review_images_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

