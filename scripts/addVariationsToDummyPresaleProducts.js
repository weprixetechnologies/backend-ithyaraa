const productService = require('../services/productServices');
const db = require('../utils/dbconnect');

// Helper function to generate variation slug
function generateVariationSlug(size) {
    return size.toLowerCase().replace(/\s+/g, '-');
}

// Create variations for a presale product
async function createVariationsForProduct(presaleProductID, productName, regularPrice, salePrice) {
    // Common sizes for sarees
    const sizes = ['S', 'M', 'L', 'XL'];
    
    const variations = sizes.map((size) => {
        // Calculate variation prices (can be same as product or slightly different)
        const variationPrice = regularPrice;
        const variationSalePrice = salePrice;
        
        // Create variation values array
        const variationValues = [
            { Size: size }
        ];
        
        // Generate variation slug
        const variationSlug = generateVariationSlug(size);
        
        return {
            variationName: size,
            variationSlug: variationSlug,
            variationPrice: variationPrice,
            variationSalePrice: variationSalePrice,
            variationStock: Math.floor(Math.random() * 20) + 10, // Random stock between 10-30
            variationValues: variationValues
        };
    });
    
    try {
        const result = await productService.uploadVariationMap({
            variations: variations,
            productID: presaleProductID
        });
        
        return result;
    } catch (error) {
        console.error(`Error creating variations for ${presaleProductID}:`, error);
        return { success: false, error: error.message };
    }
}

// Main function to add variations to all dummy presale products
async function addVariationsToDummyProducts() {
    console.log('Starting to add variations to dummy presale products...\n');
    
    try {
        // Get all presale products
        const [allProducts] = await db.query(`
            SELECT 
                presaleProductID,
                name,
                regularPrice,
                salePrice
            FROM presale_products
            ORDER BY createdAt DESC
        `);
        
        // Filter products that don't have variations
        const products = [];
        for (const product of allProducts) {
            const [variations] = await db.query(
                'SELECT variationID FROM variations WHERE productID = ? COLLATE utf8mb4_unicode_ci LIMIT 1',
                [product.presaleProductID]
            );
            if (variations.length === 0) {
                products.push(product);
            }
        }
        
        if (products.length === 0) {
            console.log('No products found without variations.');
            return;
        }
        
        console.log(`Found ${products.length} products without variations.\n`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            console.log(`Processing product ${i + 1}/${products.length}: ${product.name}`);
            console.log(`  Presale Product ID: ${product.presaleProductID}`);
            
            const result = await createVariationsForProduct(
                product.presaleProductID,
                product.name,
                parseFloat(product.regularPrice),
                parseFloat(product.salePrice)
            );
            
            if (result.success) {
                console.log(`  ✓ Successfully created variations\n`);
                successCount++;
            } else {
                console.error(`  ✗ Failed to create variations: ${result.error || result.message}\n`);
                errorCount++;
            }
        }
        
        console.log('\n========================================');
        console.log(`Summary:`);
        console.log(`  Successfully added variations to: ${successCount} products`);
        console.log(`  Failed: ${errorCount} products`);
        console.log(`  Total: ${products.length} products`);
        console.log('========================================\n');
        
    } catch (error) {
        console.error('Error in main function:', error);
        throw error;
    }
}

// Run the script
if (require.main === module) {
    addVariationsToDummyProducts()
        .then(() => {
            console.log('Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { addVariationsToDummyProducts };

