UPDATE product_variants
SET barcode = CONCAT('0', barcode)
WHERE barcode IS NOT NULL
  AND barcode ~ '^[0-9]+$'
  AND MOD(LENGTH(barcode), 2) = 1
  AND NOT EXISTS (
      SELECT 1
      FROM product_variants AS existing_variant
      WHERE existing_variant.barcode = CONCAT('0', product_variants.barcode)
  );
