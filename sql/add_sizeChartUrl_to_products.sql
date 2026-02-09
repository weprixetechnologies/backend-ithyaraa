-- Add sizeChartUrl to products for variable product size charts

ALTER TABLE `products`
ADD COLUMN `sizeChartUrl` VARCHAR(1024) NULL AFTER `slug`;

