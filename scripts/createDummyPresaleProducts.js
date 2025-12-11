const presaleProductModel = require('../model/presaleProductModel');
const { randomUUID } = require('crypto');

// Helper function to generate presale product ID
function generatePresaleProductID() {
    return `PRESALE_${randomUUID().substring(0, 8).toUpperCase()}`;
}

// Helper function to get future dates
function getFutureDate(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
}

// Dummy presale products data
const dummyProducts = [
    {
        presaleProductID: generatePresaleProductID(),
        name: "Silk Embroidered Designer Saree with Matching Blouse",
        description: "Premium silk saree with intricate embroidery work. Perfect for weddings and special occasions.\n\nSaree Material: Pure Silk\nBlouse Material: Silk with Embroidered Border\nOccasion: Wedding, Party\nCare: Dry Clean Only",
        regularPrice: 15000,
        salePrice: 8999,
        discountType: "percentage",
        discountValue: 40,
        type: "variable",
        status: "active",
        brand: "inhouse",
        brandID: null,
        featuredImage: JSON.stringify([
            {
                imgUrl: "https://ithyaraa.b-cdn.net/saree-1.jpg",
                imgAlt: "Silk Embroidered Designer Saree"
            }
        ]),
        galleryImage: JSON.stringify([
            {
                imgUrl: "https://ithyaraa.b-cdn.net/saree-1-gallery-1.jpg",
                imgAlt: "Saree Gallery Image 1"
            },
            {
                imgUrl: "https://ithyaraa.b-cdn.net/saree-1-gallery-2.jpg",
                imgAlt: "Saree Gallery Image 2"
            }
        ]),
        categories: JSON.stringify([
            {
                categoryID: 2,
                categoryName: "Dresses"
            }
        ]),
        tab1: "Material & Care:\nFabric: Pure Silk\nBlouse: Silk with Embroidered Border\nCare Instructions: Dry Clean Only\nStorage: Store in a cool, dry place",
        tab2: "Make a statement at your next special event with this exquisite silk embroidered saree. The intricate handwork and premium quality fabric ensure you stand out with elegance and grace.",
        minOrderQuantity: 1,
        maxOrderQuantity: 3,
        totalAvailableQuantity: 50,
        reservedQuantity: 0,
        preSaleStartDate: getFutureDate(0), // Today
        preSaleEndDate: getFutureDate(15), // 15 days from now
        expectedDeliveryDate: getFutureDate(30), // 30 days from now
        earlyBirdDiscount: 35,
        earlyBirdEndDate: getFutureDate(3), // 3 days from now
        allowCustomerImageUpload: 0
    },
    {
        presaleProductID: generatePresaleProductID(),
        name: "Cotton Handloom Saree with Modern Print",
        description: "Comfortable cotton handloom saree with contemporary prints. Perfect for daily wear and casual occasions.\n\nSaree Material: Pure Cotton Handloom\nBlouse Material: Cotton\nOccasion: Casual, Office\nCare: Machine Washable",
        regularPrice: 3500,
        salePrice: 2499,
        discountType: "percentage",
        discountValue: 28.6,
        type: "variable",
        status: "active",
        brand: "inhouse",
        brandID: null,
        featuredImage: JSON.stringify([
            {
                imgUrl: "https://ithyaraa.b-cdn.net/cotton-saree-1.jpg",
                imgAlt: "Cotton Handloom Saree"
            }
        ]),
        galleryImage: JSON.stringify([
            {
                imgUrl: "https://ithyaraa.b-cdn.net/cotton-saree-gallery-1.jpg",
                imgAlt: "Cotton Saree Gallery 1"
            }
        ]),
        categories: JSON.stringify([
            {
                categoryID: 2,
                categoryName: "Dresses"
            }
        ]),
        tab1: "Material & Care:\nFabric: Pure Cotton Handloom\nBlouse: Cotton\nCare Instructions: Machine Washable\nIron: Medium Heat",
        tab2: "Experience comfort and style with this beautiful cotton handloom saree. The modern print design makes it perfect for everyday wear while maintaining traditional elegance.",
        minOrderQuantity: 1,
        maxOrderQuantity: 5,
        totalAvailableQuantity: 100,
        reservedQuantity: 0,
        preSaleStartDate: getFutureDate(0),
        preSaleEndDate: getFutureDate(20),
        expectedDeliveryDate: getFutureDate(35),
        earlyBirdDiscount: 25,
        earlyBirdEndDate: getFutureDate(5),
        allowCustomerImageUpload: 0
    },
    {
        presaleProductID: generatePresaleProductID(),
        name: "Georgette Party Wear Saree with Sequins",
        description: "Elegant georgette saree with sequin work. Perfect for parties and celebrations.\n\nSaree Material: Georgette\nBlouse Material: Georgette with Sequins\nOccasion: Party, Celebration\nCare: Dry Clean Recommended",
        regularPrice: 8000,
        salePrice: 5499,
        discountType: "percentage",
        discountValue: 31.25,
        type: "variable",
        status: "active",
        brand: "inhouse",
        brandID: null,
        featuredImage: JSON.stringify([
            {
                imgUrl: "https://ithyaraa.b-cdn.net/georgette-saree-1.jpg",
                imgAlt: "Georgette Party Wear Saree"
            }
        ]),
        galleryImage: JSON.stringify([
            {
                imgUrl: "https://ithyaraa.b-cdn.net/georgette-saree-gallery-1.jpg",
                imgAlt: "Georgette Saree Gallery 1"
            },
            {
                imgUrl: "https://ithyaraa.b-cdn.net/georgette-saree-gallery-2.jpg",
                imgAlt: "Georgette Saree Gallery 2"
            }
        ]),
        categories: JSON.stringify([
            {
                categoryID: 2,
                categoryName: "Dresses"
            }
        ]),
        tab1: "Material & Care:\nFabric: Georgette\nBlouse: Georgette with Sequins\nCare Instructions: Dry Clean Recommended\nStorage: Hang or fold carefully",
        tab2: "Shine bright at your next party with this stunning georgette saree featuring beautiful sequin work. The flowing fabric and elegant design make it a perfect choice for special occasions.",
        minOrderQuantity: 1,
        maxOrderQuantity: 2,
        totalAvailableQuantity: 75,
        reservedQuantity: 0,
        preSaleStartDate: getFutureDate(0),
        preSaleEndDate: getFutureDate(18),
        expectedDeliveryDate: getFutureDate(32),
        earlyBirdDiscount: 30,
        earlyBirdEndDate: getFutureDate(4),
        allowCustomerImageUpload: 0
    },
    {
        presaleProductID: generatePresaleProductID(),
        name: "Chiffon Designer Saree with Zari Border",
        description: "Luxurious chiffon saree with traditional zari border. Ideal for festive occasions.\n\nSaree Material: Chiffon\nBlouse Material: Chiffon with Zari Work\nOccasion: Festival, Wedding\nCare: Dry Clean Only",
        regularPrice: 12000,
        salePrice: 7999,
        discountType: "percentage",
        discountValue: 33.3,
        type: "variable",
        status: "active",
        brand: "inhouse",
        brandID: null,
        featuredImage: JSON.stringify([
            {
                imgUrl: "https://ithyaraa.b-cdn.net/chiffon-saree-1.jpg",
                imgAlt: "Chiffon Designer Saree"
            }
        ]),
        galleryImage: JSON.stringify([
            {
                imgUrl: "https://ithyaraa.b-cdn.net/chiffon-saree-gallery-1.jpg",
                imgAlt: "Chiffon Saree Gallery 1"
            },
            {
                imgUrl: "https://ithyaraa.b-cdn.net/chiffon-saree-gallery-2.jpg",
                imgAlt: "Chiffon Saree Gallery 2"
            }
        ]),
        categories: JSON.stringify([
            {
                categoryID: 2,
                categoryName: "Dresses"
            }
        ]),
        tab1: "Material & Care:\nFabric: Chiffon\nBlouse: Chiffon with Zari Work\nCare Instructions: Dry Clean Only\nStorage: Store flat or hang",
        tab2: "Celebrate festivals in style with this beautiful chiffon saree featuring traditional zari border. The premium quality and elegant design make it a timeless addition to your wardrobe.",
        minOrderQuantity: 1,
        maxOrderQuantity: 3,
        totalAvailableQuantity: 60,
        reservedQuantity: 0,
        preSaleStartDate: getFutureDate(0),
        preSaleEndDate: getFutureDate(25),
        expectedDeliveryDate: getFutureDate(40),
        earlyBirdDiscount: 32,
        earlyBirdEndDate: getFutureDate(7),
        allowCustomerImageUpload: 0
    },
    {
        presaleProductID: generatePresaleProductID(),
        name: "Linen Casual Saree with Contemporary Design",
        description: "Comfortable linen saree with modern contemporary prints. Perfect for office and casual outings.\n\nSaree Material: Pure Linen\nBlouse Material: Linen\nOccasion: Casual, Office\nCare: Machine Washable",
        regularPrice: 4500,
        salePrice: 3299,
        discountType: "percentage",
        discountValue: 26.7,
        type: "variable",
        status: "active",
        brand: "inhouse",
        brandID: null,
        featuredImage: JSON.stringify([
            {
                imgUrl: "https://ithyaraa.b-cdn.net/linen-saree-1.jpg",
                imgAlt: "Linen Casual Saree"
            }
        ]),
        galleryImage: JSON.stringify([
            {
                imgUrl: "https://ithyaraa.b-cdn.net/linen-saree-gallery-1.jpg",
                imgAlt: "Linen Saree Gallery 1"
            }
        ]),
        categories: JSON.stringify([
            {
                categoryID: 2,
                categoryName: "Dresses"
            }
        ]),
        tab1: "Material & Care:\nFabric: Pure Linen\nBlouse: Linen\nCare Instructions: Machine Washable\nIron: High Heat Recommended",
        tab2: "Stay comfortable and stylish with this linen saree featuring contemporary designs. Perfect for everyday wear, office, or casual occasions with a modern twist.",
        minOrderQuantity: 1,
        maxOrderQuantity: 4,
        totalAvailableQuantity: 80,
        reservedQuantity: 0,
        preSaleStartDate: getFutureDate(0),
        preSaleEndDate: getFutureDate(22),
        expectedDeliveryDate: getFutureDate(38),
        earlyBirdDiscount: 24,
        earlyBirdEndDate: getFutureDate(6),
        allowCustomerImageUpload: 0
    }
];

// Function to create dummy presale products
async function createDummyPresaleProducts() {
    console.log('Starting to create dummy presale products...\n');
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < dummyProducts.length; i++) {
        const product = dummyProducts[i];
        try {
            // Parse JSON strings back to objects for the model
            const productData = {
                ...product,
                featuredImage: JSON.parse(product.featuredImage),
                galleryImage: JSON.parse(product.galleryImage),
                categories: JSON.parse(product.categories)
            };

            const result = await presaleProductModel.createPresaleProduct(productData);
            
            if (result.success) {
                console.log(`✓ Created product ${i + 1}: ${product.name}`);
                console.log(`  Presale Product ID: ${product.presaleProductID}\n`);
                successCount++;
            } else {
                console.error(`✗ Failed to create product ${i + 1}: ${product.name}`);
                console.error(`  Error: ${result.message}\n`);
                errorCount++;
            }
        } catch (error) {
            console.error(`✗ Error creating product ${i + 1}: ${product.name}`);
            console.error(`  Error: ${error.message}\n`);
            errorCount++;
        }
    }

    console.log('\n========================================');
    console.log(`Summary:`);
    console.log(`  Successfully created: ${successCount} products`);
    console.log(`  Failed: ${errorCount} products`);
    console.log(`  Total: ${dummyProducts.length} products`);
    console.log('========================================\n');
}

// Run the script
if (require.main === module) {
    createDummyPresaleProducts()
        .then(() => {
            console.log('Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = { createDummyPresaleProducts };

