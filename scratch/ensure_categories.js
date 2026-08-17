const db = require('../utils/dbconnect');

const requiredCategories = [
    { categoryName: "Co-ord Sets", slug: "co-ord-sets" },
    { categoryName: "Kurtis", slug: "kurtis" },
    { categoryName: "Trendy Tops", slug: "trendy-tops" },
    { categoryName: "Ethnic wear", slug: "ethnic-wear" },
    { categoryName: "Festive wear", slug: "festive-wear" },
    { categoryName: "Office wear", slug: "office-wear" },
    { categoryName: "Casual wear", slug: "casual-wear" },
    { categoryName: "Western wear", slug: "western-wear" },
    { categoryName: "Trendy Kurtis", slug: "trendy-kurtis" }
];

async function ensureCategories() {
    try {
        console.log("Checking categories in DB...");
        const [existing] = await db.query("SELECT * FROM categories");
        console.log(`Found ${existing.length} existing categories.`);

        for (const cat of requiredCategories) {
            const match = existing.find(
                (e) => e.categoryName.toLowerCase().trim() === cat.categoryName.toLowerCase().trim()
            );

            if (!match) {
                const query = `
                    INSERT INTO categories (categoryName, slug, featuredImage, categoryBanner, count, isFeatured)
                    VALUES (?, ?, ?, ?, 0, 0)
                `;
                const [res] = await db.query(query, [
                    cat.categoryName,
                    cat.slug,
                    'https://ithyaraa.b-cdn.net/ithyaraa-logo.png',
                    'https://ithyaraa.b-cdn.net/ithyaraa-logo.png'
                ]);
                console.log(`+ Created category: "${cat.categoryName}" (ID: ${res.insertId})`);
            } else {
                console.log(`= Existing category: "${match.categoryName}" (ID: ${match.categoryID})`);
            }
        }
        console.log("Category check and seeding completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Error ensuring categories:", err);
        process.exit(1);
    }
}

ensureCategories();
