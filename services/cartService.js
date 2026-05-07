const cartModel = require('../model/cartModel');
const settingsModel = require('../model/settingsModel');
const db = require('./../utils/dbconnect');
const flashSaleModel = require('../model/flashSaleModel');
const crossSellModel = require('../model/crossSellModel');

async function addToCart(uid, productID, quantity, variationID, variationName, referBy, customInputs, selectedDressType) {
    // 1. Fetch product
    const product = await cartModel.getProductByID(productID);
    console.log(product);

    if (!product) throw new Error('Product not found');

    // 2. Ensure user has a cart
    const cart = await cartModel.getOrCreateCart(uid);
    // Only update referBy if explicitly provided and not empty
    if (referBy && referBy.trim() !== '') {
        try {
            await cartModel.updateCartReferBy(uid, referBy);
        } catch (e) {
            console.error('Failed to update cart referBy:', e);
        }
    }

    // 3. Get variation prices if variationID is provided
    let regularPrice = product.regularPrice;
    let salePrice = product.salePrice;

    // Handle Dress Type logic (Dynamic Pricing for Custom Products)
    let dressTypes = [];
    try {
        if (product.dressTypes) {
            dressTypes = typeof product.dressTypes === 'string' ? JSON.parse(product.dressTypes) : product.dressTypes;
        }
    } catch (e) {
        console.error('Failed to parse dressTypes:', e);
    }

    if (Array.isArray(dressTypes) && dressTypes.length > 0) {
        if (!selectedDressType || !selectedDressType.label) {
            throw new Error('Please select a dress type');
        }

        const matchedType = dressTypes.find(dt => dt.label === selectedDressType.label);
        if (!matchedType) {
            throw new Error('Invalid dress type selected');
        }

        // Override prices with dress type price
        regularPrice = matchedType.price;
        salePrice = matchedType.price;

        // Inject selection into customInputs for display
        customInputs = customInputs || {};
        customInputs['Dress Type'] = matchedType.label;
    }

    if (variationID) {
        const variation = await cartModel.getVariationByID(variationID);
        if (variation) {
            regularPrice = variation.variationPrice;
            salePrice = variation.variationSalePrice || variation.variationPrice;
        }
    }

    // 3.5. Flash sale: single minimal query, no extra data
    let flashSalePrice = null;
    try {
        const flash = await flashSaleModel.getActiveFlashForProduct(productID);
        if (flash) {
            const base = Number(regularPrice);
            const dtype = String(flash.discountType || '').toLowerCase();
            const dval = Number(flash.discountValue || 0);
            if (!Number.isNaN(base) && dval > 0) {
                if (dtype === 'percentage') flashSalePrice = Math.max(0, +(base * (dval / 100 * -1 + 1)).toFixed(2));
                else if (dtype === 'fixed') flashSalePrice = Math.max(0, +(base - dval).toFixed(2));
            }
        }
    } catch (_) { }

    // 4. Calculate base price (flash sale price takes precedence over regular sale price)
    const basePrice = flashSalePrice ?? salePrice ?? regularPrice;
    const lineTotalBefore = Number((basePrice * quantity).toFixed(2));
    const lineTotalAfter = lineTotalBefore; // initially same (no discount yet)

    // 4. Check if item with same productID AND variationID exists
    const existingItem = await cartModel.getCartItemWithVariation(cart.cartID, productID, variationID);
    let cartItem;

    if (existingItem) {
        // 5. Update quantity if exact same variation exists
        const newQuantity = existingItem.quantity + quantity;
        const newLineTotalBefore = Number((basePrice * newQuantity).toFixed(2));
        const newLineTotalAfter = newLineTotalBefore;

        cartItem = await cartModel.updateCartItemQuantity(
            existingItem.cartItemID,
            newQuantity,
            newLineTotalBefore,
            newLineTotalAfter
        );
    } else {
        // 6. Insert new item if variation is different or new
        cartItem = await cartModel.insertCartItem({
            cartID: cart.cartID,
            uid,
            productID,
            quantity,
            regularPrice: regularPrice,
            salePrice: flashSalePrice ?? salePrice,
            overridePrice: null,
            unitPriceBefore: basePrice,
            unitPriceAfter: basePrice,
            lineTotalBefore,
            lineTotalAfter,
            offerID: product.offerID,
            name: product.name,
            featuredImage: product.featuredImage,
            variationID,
            variationName,
            brandID: product.brandID,
            customInputs: customInputs,
            isFlashSale: Boolean(flashSalePrice)
        });
    }

    // 7. Update cart totals
    const updatedCartDetail = await cartModel.updateCartTotals(cart.cartID);

    // 8. Fetch cross-sell products for the added product (non-blocking, won't fail cart addition)
    let crossSellProducts = [];
    try {
        const crossSells = await crossSellModel.getCrossSellProducts(productID);
        // Extract only the first image URL for cross-sell products
        crossSellProducts = crossSells.map(p => {
            const parsed = { ...p };
            let imageUrl = null;
            try {
                let featuredImage = parsed.featuredImage;
                if (typeof featuredImage === 'string') {
                    featuredImage = JSON.parse(featuredImage);
                }
                if (Array.isArray(featuredImage) && featuredImage.length > 0) {
                    const firstImage = featuredImage[0];
                    if (firstImage && firstImage.imgUrl) {
                        imageUrl = firstImage.imgUrl;
                    }
                }
            } catch (error) {
                console.error('Error parsing featuredImage for cross-sell product:', error);
            }
            return {
                productID: parsed.productID,
                name: parsed.name,
                regularPrice: parsed.regularPrice,
                salePrice: parsed.salePrice,
                type: parsed.type || 'variable',
                imageUrl: imageUrl || null
            };
        });
    } catch (error) {
        // Silently fail - don't let cross-sell fetch errors affect cart addition
        console.error('Error fetching cross-sell products (non-critical):', error);
        crossSellProducts = [];
    }

    return { cartItem, cartDetail: updatedCartDetail, crossSellProducts };
}
async function generateUniqueComboID() {
    let uniqueID;
    let exists = true;

    while (exists) {
        // 1. Generate random ID: e.g. COIT123456
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        uniqueID = `COIT${randomNum}`;

        // 2. Check if it exists in cart_items
        const [rows] = await db.query(
            'SELECT 1 FROM cart_items WHERE comboID = ? LIMIT 1',
            [uniqueID]
        );

        exists = rows.length > 0; // if exists → loop again
    }

    return uniqueID;
}


async function addCartCombo(uid, quantity, mainProductID, products) {
    // 1. Ensure user has a cart
    const comboID = await generateUniqueComboID()
    const cart = await cartModel.getOrCreateCart(uid);

    // 2. Fetch main product
    const mainProduct = await cartModel.getProductByIDCombo(mainProductID);
    if (!mainProduct) throw new Error('Main product not found');
    console.log(mainProduct);

    // 3. Always insert into cart_items (combo parent)
    // const basePrice = mainProduct.salePrice ?? mainProduct.regularPrice;
    const basePrice = mainProduct.salePrice ?? mainProduct.regularPrice;
    const lineTotalBefore = Number((basePrice * quantity).toFixed(2));
    const lineTotalAfter = lineTotalBefore;

    const cartItem = await cartModel.insertCartItemCombo({
        cartID: cart.cartID,
        uid,
        productID: mainProductID,
        quantity,
        regularPrice: mainProduct.regularPrice,
        salePrice: mainProduct.salePrice,
        overridePrice: null,
        unitPriceBefore: basePrice,
        unitPriceAfter: basePrice,
        lineTotalBefore,
        lineTotalAfter,
        offerID: mainProduct.offerID,
        name: mainProduct.name,
        featuredImage: mainProduct.featuredImage,
        comboID: comboID
    });

    // 4. Insert all child products into order_combo_items (no check for duplicates)
    for (const p of products) {
        const product = await cartModel.getProductByIDCombo(p.productID);
        if (!product) continue; // skip if missing

        const variation = await cartModel.getVariationByIDCombo(p.variationID);
        await cartModel.insertComboItemCombo({
            comboID: comboID,
            productID: p.productID,
            variationID: p.variationID,
            productName: product.name,
            featuredImage: product.featuredImage,
            variationName: variation?.name ?? null
        });
    }

    // 5. Update cart totals after insert
    const updatedCartDetail = await cartModel.updateCartTotals(cart.cartID);

    return { cartItem, cartDetail: updatedCartDetail };
}



async function getCart(uid) {
    async function recomputeItemBaseWithFlash(item, variationMap) {
        if (!item || item.productType === 'combo') return;

        const quantity = Number(item.quantity) || 0;
        if (item.overridePrice != null) item.overridePrice = Number(item.overridePrice);
        if (item.regularPrice != null) item.regularPrice = Number(item.regularPrice);
        if (item.salePrice != null) item.salePrice = Number(item.salePrice);

        // 1) Determine regular & sale bases
        let regularBase = null;
        let saleBase = null;

        if (item.variationID && variationMap) {
            const v = variationMap.get(item.variationID) || null;
            if (v) {
                if (v.variationPrice != null) {
                    regularBase = Number(v.variationPrice);
                }
                if (v.variationSalePrice != null) {
                    saleBase = Number(v.variationSalePrice);
                }
            }
        }

        if (regularBase === null || Number.isNaN(regularBase)) {
            regularBase = Number(item.regularPrice);
        }
        if (saleBase === null || Number.isNaN(saleBase)) {
            saleBase = Number(item.salePrice);
        }

        // 2) Flash: always check current flash status from DB
        const flash = await flashSaleModel.getActiveFlashForProduct(item.productID);

        let flashUnit = null;
        if (!flash) {
            item.isFlashSale = 0;
        } else {
            const dtype = String(flash.discountType || '').toLowerCase();
            const dval = Number(flash.discountValue || 0);

            if (dval > 0 && (dtype === 'percentage' || dtype === 'fixed' || dtype === 'flat') && !Number.isNaN(regularBase)) {
                flashUnit = regularBase;
                if (dtype === 'percentage') {
                    flashUnit = Math.max(0, +(regularBase * (1 - dval / 100)).toFixed(2));
                } else {
                    // fixed/flat
                    flashUnit = Math.max(0, +(regularBase - dval).toFixed(2));
                }
                item.isFlashSale = 1;
            } else {
                item.isFlashSale = 0;
            }
        }

        // 3) Compute before/after prices
        if (item.isFlashSale && flashUnit != null) {
            // Before = regular (no flash), After = flash price (or override)
            const unitBefore = Number.isNaN(regularBase) ? 0 : regularBase;
            const override = (item.overridePrice != null && !Number.isNaN(item.overridePrice))
                ? item.overridePrice
                : null;

            const unitAfterBase = flashUnit;
            const unitAfter = override != null ? override : unitAfterBase;

            item.salePrice = unitAfterBase; // per-unit flash price

            item.unitPriceBefore = unitBefore;
            item.unitPriceAfter = unitAfter;
            item.lineTotalBefore = Number((unitBefore * quantity).toFixed(2));
            item.lineTotalAfter = Number((unitAfter * quantity).toFixed(2));
        } else {
            // No flash → use existing sale/regular + override; before/after the same
            let base = !Number.isNaN(saleBase) ? saleBase : regularBase;
            if (Number.isNaN(base)) base = 0;

            const override = (item.overridePrice != null && !Number.isNaN(item.overridePrice))
                ? item.overridePrice
                : null;

            const unit = override != null ? override : base;
            item.unitPriceBefore = unit;
            item.unitPriceAfter = unit;
            item.lineTotalBefore = Number((unit * quantity).toFixed(2));
            item.lineTotalAfter = item.lineTotalBefore;
        }
    }

    // Batch helpers for variations and combo items so we avoid N+1
    async function buildVariationMap(items) {
        const ids = [...new Set(items.map(i => i.variationID).filter(Boolean))];
        if (ids.length === 0) return new Map();

        const placeholders = ids.map(() => '?').join(',');
        const [rows] = await db.query(
            `SELECT * FROM variations WHERE variationID IN (${placeholders})`,
            ids
        );

        const map = new Map();
        for (const row of rows) {
            map.set(row.variationID, row);
        }
        return map;
    }

    async function buildComboMap(items) {
        const comboIDs = [...new Set(items.map(i => i.comboID).filter(Boolean))];
        if (comboIDs.length === 0) return new Map();

        const placeholders = comboIDs.map(() => '?').join(',');
        const query = `
            SELECT 
                oci.comboID,
                oci.productID, 
                oci.variationID, 
                p.name, 
                p.featuredImage, 
                p.brandID,
                p.brand,
                p.status AS productStatus,
                v.variationSlug AS variationName,
                v.variationValues,
                v.variationStock
            FROM order_combo_items oci
            JOIN products p ON oci.productID = p.productID
            LEFT JOIN variations v ON oci.variationID = v.variationID
            WHERE oci.comboID IN (${placeholders})
        `;
        const [rows] = await db.query(query, comboIDs);

        const map = new Map();
        for (const row of rows) {
            let variationValues = [];
            try {
                if (row.variationValues) {
                    variationValues = JSON.parse(row.variationValues);
                }
            } catch (err) {
                variationValues = [];
            }
            const entry = {
                productID: row.productID,
                variationID: row.variationID,
                name: row.name,
                featuredImage: row.featuredImage,
                brandID: row.brandID,
                brand: row.brand,
                variationName: row.variationName,
                variationValues,
                variationStock: row.variationStock,
                productStatus: row.productStatus
            };
            const list = map.get(row.comboID) || [];
            list.push(entry);
            map.set(row.comboID, list);
        }
        return map;
    }

    const modified = await cartModel.getCartModifiedFlag(uid);

    if (modified === 1) {
        const items = await cartModel.getCartItems(uid);
        const [variationMap, comboMap] = await Promise.all([
            buildVariationMap(items),
            buildComboMap(items),
        ]);

        // Safety Check: Sync offerID with the latest product-level offer association
        for (const item of items) {
            if (item.productType !== 'combo' && item.offerID !== item.currentProductOfferID) {
                console.log(`[Offer Safety] Syncing offer for product ${item.productID}: ${item.offerID} -> ${item.currentProductOfferID}`);
                item.offerID = item.currentProductOfferID;
            }
        }

        // Normalize pricing for each item from current DB state (including flash)
        for (const item of items) {
            if (item.productType === 'combo') {
                const comboItems = item.comboID ? (comboMap.get(item.comboID) || []) : [];
                item.comboItems = comboItems;
                // Preserve combo parent pricing as stored
                if (item.unitPriceBefore != null && item.quantity != null) {
                    const before = Number(item.unitPriceBefore);
                    const after = (item.unitPriceAfter != null) ? Number(item.unitPriceAfter) : before;
                    item.lineTotalBefore = Number((before * item.quantity).toFixed(2));
                    item.lineTotalAfter = Number((after * item.quantity).toFixed(2));
                }
                continue;
            }

            await recomputeItemBaseWithFlash(item, variationMap);

            const comboItems = item.comboID ? (comboMap.get(item.comboID) || []) : [];
            item.comboItems = comboItems;
        }

        // Sanitize: segregate flash-sale items from offers (null offerID so they are not eligible)
        for (const item of items) {
            if (item.isFlashSale) {
                item.offerID = null;
                item.offerApplied = false;
                item.offerStatus = 'none';
            } else if (item.offerID) {
                item.offerApplied = false;
                item.offerStatus = 'none';
            }
        }

        // Offer application: only items with offerID are eligible (flash items have null offerID)
        const processedOfferIDsFast = new Set();
        for (const item of items) {
            const comboItems = item.comboID ? (comboMap.get(item.comboID) || []) : [];
            item.comboItems = comboItems;

            if (!item.offerID || processedOfferIDsFast.has(item.offerID)) continue;

            const offer = await cartModel.getActiveOfferByID(item.offerID);
            const affectedItems = items.filter(i =>
                i.offerID === item.offerID &&
                i.productType !== 'combo' &&
                (i.selected === true || i.selected === 1 || i.selected === null)
            );

            if (!offer) {
                affectedItems.forEach(i => { i.offerStatus = 'expired'; });
                continue;
            }
            if (!offer.buyCount || offer.buyCount <= 0) {
                affectedItems.forEach(i => { i.offerStatus = 'missing'; });
                continue;
            }
            affectedItems.forEach(i => {
                if (i.unitPriceBefore === undefined || i.unitPriceBefore === null) {
                    i.unitPriceBefore = i.overridePrice ?? i.salePrice ?? i.regularPrice;
                }
            });
            if (offer.offerType === 'buy_x_get_y') {
                applyBuyXGetY(affectedItems, offer);
            } else if (offer.offerType === 'buy_x_at_x') {
                applyBuyXAtXxx(affectedItems, offer);
            }
            processedOfferIDsFast.add(item.offerID);
        }

        // Build per-item totals
        items.forEach(item => {
            if (item.unitPriceBefore === undefined || item.unitPriceBefore === null) {
                item.unitPriceBefore = Number(item.overridePrice ?? item.salePrice ?? item.regularPrice);
            }
            if (item.unitPriceAfter === undefined || item.unitPriceAfter === null) {
                item.unitPriceAfter = item.unitPriceBefore;
            }
            item.lineTotalBefore = Number((item.unitPriceBefore * item.quantity).toFixed(2));
            item.lineTotalAfter = Number((item.unitPriceAfter * item.quantity).toFixed(2));

            // --- STOCK & AVAILABILITY LOGIC ---
            item.isAvailable = true;
            item.stockStatus = 'in_stock';

            if (item.productType === 'customproduct') {
                // Always in stock
                item.isAvailable = true;
                item.stockStatus = 'in_stock';
            } else if (item.productType === 'combo') {
                const children = item.comboItems || [];
                let minStock = Infinity;
                let isOut = false;

                for (const child of children) {
                    const isProductOut = child.productStatus === 'Out of Stock';
                    const isVariationOut = child.variationID && (child.variationStock === null || child.variationStock <= 0);
                    
                    if (isProductOut || isVariationOut) {
                        isOut = true;
                        break;
                    }
                    if (child.variationID && child.variationStock < item.quantity) {
                        minStock = Math.min(minStock, child.variationStock);
                    }
                }

                if (isOut) {
                    item.isAvailable = false;
                    item.stockStatus = 'out_of_stock';
                } else if (minStock < item.quantity) {
                    item.isAvailable = false;
                    item.stockStatus = 'low_stock';
                    item.variationStock = minStock; // Provide the limiting stock
                }
            } else if (item.productType === 'variable') {
                if (item.variationID) {
                    const stock = item.variationStock;
                    if (stock === null || stock <= 0) {
                        item.isAvailable = false;
                        item.stockStatus = 'out_of_stock';
                    } else if (stock < item.quantity) {
                        item.isAvailable = false;
                        item.stockStatus = 'low_stock';
                    }
                } else if (item.productStatus === 'Out of Stock') {
                    item.isAvailable = false;
                    item.stockStatus = 'out_of_stock';
                }
            } else {
                // Regular product
                if (item.productStatus === 'Out of Stock') {
                    item.isAvailable = false;
                    item.stockStatus = 'out_of_stock';
                }
            }
        });

        // Write recomputed pricing (flash + offers) to DB
        await cartModel.updateCartItems(items);

        // Summary: subtotal = sum(regularPrice * quantity), total = sum(lineTotalAfter), totalDiscount = subtotal - total
        const selectedItems = items.filter(i => i.selected === true || i.selected === 1 || i.selected === null);
        const subtotal = Number(selectedItems.reduce((sum, i) => sum + (Number(i.regularPrice) || 0) * (Number(i.quantity) || 0), 0).toFixed(2));
        const total = Number(selectedItems.reduce((sum, i) => sum + (i.lineTotalAfter || 0), 0).toFixed(2));
        const totalDiscount = Number((subtotal - total).toFixed(2));
        const summary = { subtotal, total, totalDiscount, anyModifications: items.some(it => it.isFlashSale) };

        // Shipping Fee Logic: Brand-Specific + Inhouse (Admin)
        if (summary.total < 999) {
            const uniqueBrandIDs = [...new Set(selectedItems.filter(i => i.brandID).map(i => i.brandID))];
            const hasInhouse = selectedItems.some(i => !i.brandID || i.productType === 'combo' || i.productType === 'customproduct');

            let shippingFee = 0;
            if (uniqueBrandIDs.length > 0) {
                const brandShippingMap = await cartModel.getBrandShippingCharges(uniqueBrandIDs);
                uniqueBrandIDs.forEach(bid => {
                    shippingFee += (brandShippingMap.get(bid) || 0);
                });
            }

            if (hasInhouse) {
                const globalShippingFee = await settingsModel.getSetting('shipping_fee');
                shippingFee += (Number(globalShippingFee) || 50);
            }

            summary.shipping = shippingFee;
        } else {
            summary.shipping = 0;
        }
        summary.total = Number((summary.total + summary.shipping).toFixed(2));

        // Write to cartDetail table
        await cartModel.updateCartDetail(uid, summary);

        const cart = await cartModel.getOrCreateCart(uid);
        const anyFlash = items.some(it => it.isFlashSale);
        if (anyFlash) {
            await cartModel.setCartModified(cart.cartID, true);
        } else {
            await cartModel.setCartModified(cart.cartID, false);
        }

        if (cart && cart.referBy) items.forEach(i => { i.referBy = cart.referBy; });
        console.log('Fast path - returning cached cart');
        return { items, summary, cartID: cart.cartID };
    }

    let items = await cartModel.getCartItems(uid);
    const [variationMap, comboMap] = await Promise.all([
        buildVariationMap(items),
        buildComboMap(items),
    ]);
    let anyModifications = false;
    const processedOfferIDs = new Set();

    // Safety Check: Sync offerID with the latest product-level offer association
    for (const item of items) {
        if (item.productType !== 'combo' && item.offerID !== item.currentProductOfferID) {
            console.log(`[Offer Safety] Syncing offer for product ${item.productID}: ${item.offerID} -> ${item.currentProductOfferID}`);
            item.offerID = item.currentProductOfferID;
            anyModifications = true;
        }
    }

    // Initialize item flags and parse prices; recompute base/flash from current DB state
    for (const item of items) {
        item.offerApplied = false;
        item.offerStatus = 'none';
        if (item.salePrice != null) item.salePrice = Number(item.salePrice);
        if (item.regularPrice != null) item.regularPrice = Number(item.regularPrice);
        if (item.overridePrice != null) item.overridePrice = Number(item.overridePrice);

        // Skip recalculation for combo parent items
        if (item.productType === 'combo') {
            const comboItems = item.comboID ? (comboMap.get(item.comboID) || []) : [];
            item.comboItems = comboItems;
            // Ensure totals reflect stored unit prices
            if (item.unitPriceBefore != null && item.quantity != null) {
                const before = Number(item.unitPriceBefore);
                const after = (item.unitPriceAfter != null) ? Number(item.unitPriceAfter) : before;
                item.lineTotalBefore = Number((before * item.quantity).toFixed(2));
                item.lineTotalAfter = Number((after * item.quantity).toFixed(2));
            }
            console.log(`[INIT-COMBO] Item ${item.cartItemID}: preserve combo pricing`);
            continue;
        }

        await recomputeItemBaseWithFlash(item, variationMap);
        console.log(`[INIT] Item ${item.cartItemID}: unitPriceBefore=${item.unitPriceBefore}`);
    }

    // Sanitize: segregate flash-sale items from offers — null offerID so they are not eligible for offer application
    for (const item of items) {
        if (item.isFlashSale) {
            item.offerID = null;
            item.offerApplied = false;
            item.offerStatus = 'none';
        }
    }

    // Offer application: only items with offerID (non-flash, selected, non-combo) are eligible
    for (const item of items) {
        const comboItems = item.comboID ? (comboMap.get(item.comboID) || []) : [];
        item.comboItems = comboItems;

        if (!item.offerID || processedOfferIDs.has(item.offerID)) continue;

        const offer = await cartModel.getActiveOfferByID(item.offerID);
        const affectedItems = items.filter(i =>
            i.offerID === item.offerID &&
            i.productType !== 'combo' &&
            (i.selected === true || i.selected === 1 || i.selected === null)
        );

        if (!offer) {
            affectedItems.forEach(i => i.offerStatus = 'expired');
            console.log(`[OFFER] Offer ${item.offerID} expired`);
            continue;
        }

        if (!offer.buyCount || offer.buyCount <= 0) {
            affectedItems.forEach(i => i.offerStatus = 'missing');
            console.log(`[OFFER] Offer ${item.offerID} missing buyCount`);
            continue;
        }

        // Use already-calculated unitPriceBefore (includes variation/flash sale pricing)
        affectedItems.forEach(i => {
            if (i.unitPriceBefore === undefined || i.unitPriceBefore === null) {
                i.unitPriceBefore = i.overridePrice ?? i.salePrice ?? i.regularPrice;
            }
        });

        console.log(`[OFFER] Applying ${offer.offerType} offer ${offer.offerID}`);
        if (offer.offerType === 'buy_x_get_y') {
            applyBuyXGetY(affectedItems, offer);
        } else if (offer.offerType === 'buy_x_at_x') {
            applyBuyXAtXxx(affectedItems, offer);
        }

        processedOfferIDs.add(item.offerID);
        anyModifications = true;
    }

    // Build per-item totals (preserve offer-adjusted prices if set)
    items.forEach(item => {
        // unitPriceBefore should already be set from initialization/flash sale logic
        if (item.unitPriceBefore === undefined || item.unitPriceBefore === null) {
            item.unitPriceBefore = Number(item.overridePrice ?? item.salePrice ?? item.regularPrice);
        }
        // unitPriceAfter may have been set by offer functions; if not, use unitPriceBefore
        if (item.unitPriceAfter === undefined || item.unitPriceAfter === null) {
            item.unitPriceAfter = item.unitPriceBefore;
        }

        item.lineTotalBefore = Number((item.unitPriceBefore * item.quantity).toFixed(2));
        item.lineTotalAfter = Number((item.unitPriceAfter * item.quantity).toFixed(2));

        console.log(`[TOTALS] Item ${item.cartItemID}: unitPriceBefore=${item.unitPriceBefore}, unitPriceAfter=${item.unitPriceAfter}, lineTotalBefore=${item.lineTotalBefore}, lineTotalAfter=${item.lineTotalAfter}`);

        // --- STOCK & AVAILABILITY LOGIC ---
        item.isAvailable = true;
        item.stockStatus = 'in_stock';

        if (item.productType === 'customproduct') {
            // Always in stock
            item.isAvailable = true;
            item.stockStatus = 'in_stock';
        } else if (item.productType === 'combo') {
            const children = item.comboItems || [];
            let minStock = Infinity;
            let isOut = false;

            for (const child of children) {
                const isProductOut = child.productStatus === 'Out of Stock';
                const isVariationOut = child.variationID && (child.variationStock === null || child.variationStock <= 0);
                
                if (isProductOut || isVariationOut) {
                    isOut = true;
                    break;
                }
                if (child.variationID && child.variationStock < item.quantity) {
                    minStock = Math.min(minStock, child.variationStock);
                }
            }

            if (isOut) {
                item.isAvailable = false;
                item.stockStatus = 'out_of_stock';
            } else if (minStock < item.quantity) {
                item.isAvailable = false;
                item.stockStatus = 'low_stock';
                item.variationStock = minStock;
            }
        } else if (item.productType === 'variable') {
            if (item.variationID) {
                const stock = item.variationStock;
                if (stock === null || stock <= 0) {
                    item.isAvailable = false;
                    item.stockStatus = 'out_of_stock';
                } else if (stock < item.quantity) {
                    item.isAvailable = false;
                    item.stockStatus = 'low_stock';
                }
            } else if (item.productStatus === 'Out of Stock') {
                item.isAvailable = false;
                item.stockStatus = 'out_of_stock';
            }
        } else {
            // Regular product
            if (item.productStatus === 'Out of Stock') {
                item.isAvailable = false;
                item.stockStatus = 'out_of_stock';
            }
        }
    });


    // Summary: subtotal = sum(regularPrice * quantity), total = sum(lineTotalAfter), totalDiscount = subtotal - total
    const selectedItems = items.filter(i => i.selected === true || i.selected === 1 || i.selected === null);
    const subtotal = Number(selectedItems.reduce((sum, i) => sum + (Number(i.regularPrice) || 0) * (Number(i.quantity) || 0), 0).toFixed(2));
    const total = Number(selectedItems.reduce((sum, i) => sum + (i.lineTotalAfter || 0), 0).toFixed(2));
    const totalDiscount = Number((subtotal - total).toFixed(2));

    const summary = { subtotal, total, totalDiscount, anyModifications };

    // Shipping Fee Logic: Brand-Specific + Inhouse (Admin)
    if (summary.total < 999) {
        const uniqueBrandIDs = [...new Set(selectedItems.filter(i => i.brandID).map(i => i.brandID))];
        const hasInhouse = selectedItems.some(i => !i.brandID || i.productType === 'combo' || i.productType === 'customproduct');

        let shippingFee = 0;
        if (uniqueBrandIDs.length > 0) {
            const brandShippingMap = await cartModel.getBrandShippingCharges(uniqueBrandIDs);
            uniqueBrandIDs.forEach(bid => {
                shippingFee += (brandShippingMap.get(bid) || 0);
            });
        }

        if (hasInhouse) {
            const globalShippingFee = await settingsModel.getSetting('shipping_fee');
            shippingFee += (Number(globalShippingFee) || 50);
        }

        summary.shipping = shippingFee;
    } else {
        summary.shipping = 0;
    }
    summary.total = Number((summary.total + summary.shipping).toFixed(2));

    console.log(`[SUMMARY] subtotal=${subtotal}, total=${summary.total}, totalDiscount=${totalDiscount}, shipping=${summary.shipping}`);

    // Update DB: cart_items and cartDetail
    await cartModel.updateCartItems(items);
    await cartModel.updateCartDetail(uid, summary);

    const cart = await cartModel.getOrCreateCart(uid);
    const anyFlash = items.some(it => it.isFlashSale);
    await cartModel.setCartModified(cart.cartID, anyFlash);
    if (cart && cart.referBy) {
        items.forEach(i => { i.referBy = cart.referBy; });
    }
    return { items, summary, cartID: cart.cartID };
}


// --- Offer helpers with fixed numeric handling ---
function applyBuyXGetY(affectedItems, offer) {
    const groupSize = offer.buyCount + offer.getCount;
    const totalQty = affectedItems.reduce((sum, i) => sum + i.quantity, 0);
    const numGroups = Math.floor(totalQty / groupSize);
    let qtyLeftPaid = numGroups * offer.buyCount;
    let qtyLeftFree = numGroups * offer.getCount;

    console.log(`[BUY_X_GET_X] totalQty=${totalQty}, numGroups=${numGroups}, paidQty=${qtyLeftPaid}, freeQty=${qtyLeftFree}`);

    for (const item of affectedItems) {
        const base = Number(item.unitPriceBefore ?? item.overridePrice ?? item.salePrice ?? item.regularPrice);
        const unitArray = [];

        for (let i = 0; i < item.quantity; i++) {
            if (qtyLeftPaid > 0) {
                unitArray.push(base);
                qtyLeftPaid--;
            } else if (qtyLeftFree > 0) {
                unitArray.push(0);
                qtyLeftFree--;
            } else {
                unitArray.push(base);
            }
        }

        // Use cents math to avoid float issues
        const totalCents = unitArray.reduce((a, b) => a + Math.round(b * 100), 0);
        item.unitPriceAfter = totalCents / (item.quantity * 100);
        item.unitPriceAfter = Number(item.unitPriceAfter.toFixed(2));

        item.offerApplied = true;
        item.offerStatus = 'applied';

        console.log(`[BUY_X_GET_X] Item ${item.cartItemID} unitArray=${unitArray} unitPriceAfter=${item.unitPriceAfter}`);
    }
}

function applyBuyXAtXxx(affectedItems, offer) {
    const totalQty = affectedItems.reduce((sum, i) => sum + i.quantity, 0);
    const numGroups = Math.floor(totalQty / offer.buyCount);
    const eligibleQty = numGroups * offer.buyCount;

    const bundlePricePaise = Math.round(offer.buyAt * 100);
    const discBase = Math.floor(bundlePricePaise / offer.buyCount);
    const remainder = bundlePricePaise % offer.buyCount;

    let qtyLeftEligible = eligibleQty;
    let remainderCount = remainder * numGroups;

    console.log(`[BUY_X_AT_X] totalQty=${totalQty}, eligibleQty=${eligibleQty}, discBase=${discBase}, remainder=${remainder}`);

    for (const item of affectedItems) {
        const basePaise = Math.round((item.unitPriceBefore ?? item.overridePrice ?? item.salePrice ?? item.regularPrice) * 100);
        const unitArray = [];

        for (let i = 0; i < item.quantity; i++) {
            if (qtyLeftEligible > 0) {
                let pricePaise = discBase;
                if (remainderCount > 0) {
                    pricePaise += 1;
                    remainderCount--;
                }
                pricePaise = Math.min(basePaise, pricePaise);
                unitArray.push(pricePaise / 100);
                qtyLeftEligible--;
            } else {
                unitArray.push(basePaise / 100);
            }
        }

        const totalCents = unitArray.reduce((a, b) => a + Math.round(b * 100), 0);
        item.unitPriceAfter = totalCents / (item.quantity * 100);
        item.unitPriceAfter = Number(item.unitPriceAfter.toFixed(2));

        item.offerApplied = true;
        item.offerStatus = 'applied';

        console.log(`[BUY_X_AT_X] Item ${item.cartItemID} unitArray=${unitArray} unitPriceAfter=${item.unitPriceAfter}`);
    }
}

const updateCartItemsSelected = async (uid, selectedItems) => {
    const cartModel = require('../model/cartModel');
    const result = await cartModel.updateCartItemsSelected(uid, selectedItems);

    if (result.success) {
        // Recalculate cart totals
        const cart = await cartModel.getOrCreateCart(uid);
        await cartModel.updateCartTotals(cart.cartID);
    }

    return result;
};

const removeCartItem = async (uid, cartItemID) => {
    try {
        // 1. Get user's cart
        const cart = await cartModel.getOrCreateCart(uid);
        if (!cart) {
            return { success: false, message: "Cart not found for this user" };
        }

        // 2. Check if item exists in cart
        const existingItem = await cartModel.getCartItemByID(cartItemID);
        if (!existingItem || existingItem.uid !== uid) {
            return { success: false, message: "Item not found in cart" };
        }

        // 3. Remove the item
        await cartModel.deleteCartItem(cartItemID);

        // 4. Update cart totals after removal
        const updatedCartDetail = await cartModel.updateCartTotals(cart.cartID);

        // 5. Return success response with updated cart
        return {
            success: true,
            message: "Item removed from cart",
            cartDetail: updatedCartDetail
        };
    } catch (error) {
        console.error('Error removing cart item:', error);
        return { success: false, message: "Failed to remove item from cart" };
    }
};


const updateCartItemQuantityWithStockCheck = async (uid, cartItemID, requestedQuantity) => {
    // 1. Fetch cart item joined with product type
    const cartItem = await cartModel.getCartItemWithProductType(cartItemID);
    if (!cartItem) {
        throw new Error('Cart item not found');
    }

    // 2. Security check: Ensure item belongs to the user
    if (cartItem.uid !== uid) {
        throw new Error('Access denied');
    }

    // 3. Only variable items update allowed
    if (cartItem.productType !== 'variable') {
        throw new Error('Only Variable Products Update Allowed');
    }

    // 4. Fetch variation stock
    const availableStock = await cartModel.getVariationStock(cartItem.variationID);
    
    let finalQuantity = requestedQuantity;
    let message = null;

    // 5. Stock check logic
    if (requestedQuantity > availableStock) {
        finalQuantity = availableStock;
        message = `Max ${availableStock} possible out of ${requestedQuantity} requested`;
    } else if (finalQuantity < 1) {
        finalQuantity = 1; // Minimum quantity is 1
    }

    // 6. Update quantity in DB
    // Calculate new totals using unitPriceBefore/After (to preserve any discounts/flash sale prices)
    const lineTotalBefore = Number((cartItem.unitPriceBefore * finalQuantity).toFixed(2));
    const lineTotalAfter = Number((cartItem.unitPriceAfter * finalQuantity).toFixed(2));

    await cartModel.updateCartItemQuantity(cartItemID, finalQuantity, lineTotalBefore, lineTotalAfter);

    // 7. Update cart totals
    await cartModel.updateCartTotals(cartItem.cartID);

    // 8. Fetch updated cart details
    const updatedCart = await getCart(uid);

    return {
        success: true,
        message: message,
        cart: updatedCart
    };
};

const autoUpdateCartSelection = async (uid) => {
    // 1. Fetch all cart items joined with stock and status info
    const items = await cartModel.getCartItems(uid);
    if (!items || items.length === 0) {
        return { message: 'Cart is empty', items: [] };
    }

    const results = [];
    const unselectIDs = [];
    const comboIDs = [...new Set(items.filter(i => i.comboID).map(i => i.comboID))];

    // Optimized: Fetch all combo items in one go
    let allComboItems = [];
    if (comboIDs.length > 0) {
        allComboItems = await cartModel.getComboItemsForMultipleCombos(comboIDs);
    }

    // Group combo items by comboID for quick access (DSA: Map)
    const comboItemsMap = new Map();
    allComboItems.forEach(ci => {
        if (!comboItemsMap.has(ci.comboID)) comboItemsMap.set(ci.comboID, []);
        comboItemsMap.get(ci.comboID).push(ci);
    });

    for (const item of items) {
        let stockStatus = 'in_stock';
        let canRequest = item.quantity;
        let shouldUnselect = false;

        // Custom products are always assumed to be in stock as per user request
        if (item.productType === 'customproduct') {
            results.push({
                cartItemId: item.cartItemID,
                canRequest: item.quantity,
                stockStatus: 'in_stock',
                currentRequested: item.quantity,
                productType: item.productType
            });
            continue;
        }

        if (item.comboID) {
            // Combo Stock Check
            const children = comboItemsMap.get(item.comboID) || [];
            let minStock = Infinity;
            let isOut = false;

            for (const child of children) {
                const isProductOut = child.productStatus === 'Out of Stock';
                const isVariationOut = child.variationID && (child.variationStock === null || child.variationStock <= 0);

                if (isProductOut || isVariationOut) {
                    isOut = true;
                    break;
                }
                if (child.variationID && child.variationStock < item.quantity) {
                    minStock = Math.min(minStock, child.variationStock);
                }
            }

            if (isOut) {
                shouldUnselect = true;
                stockStatus = 'out_of_stock';
                canRequest = 0;
            } else if (minStock < item.quantity) {
                shouldUnselect = true;
                stockStatus = 'low_stock';
                canRequest = minStock;
            }
        } else if (item.productType === 'variable') {
            // Variable Product Check
            if (item.variationID) {
                if (item.variationStock === null || item.variationStock <= 0) {
                    shouldUnselect = true;
                    stockStatus = 'out_of_stock';
                    canRequest = 0;
                } else if (item.variationStock < item.quantity) {
                    shouldUnselect = true; // User said: "if variationStock < quantity in cart then unselect it"
                    stockStatus = 'low_stock';
                    canRequest = item.variationStock;
                }
            }
        } else {
            // Regular Product Check
            if (item.productStatus === 'Out of Stock') {
                shouldUnselect = true;
                stockStatus = 'out_of_stock';
                canRequest = 0;
            }
        }

        if (shouldUnselect) {
            unselectIDs.push(item.cartItemID);
        }

        results.push({
            cartItemId: item.cartItemID,
            canRequest,
            stockStatus,
            currentRequested: item.quantity,
            productType: item.productType
        });
    }

    // 2. Perform bulk unselect
    if (unselectIDs.length > 0) {
        await cartModel.bulkUnselectCartItems(unselectIDs);
        // 3. Update totals (since selected items changed)
        const cart = await cartModel.getOrCreateCart(uid);
        if (cart) {
            await cartModel.updateCartTotals(cart.cartID);
        }
    }

    return {
        message: unselectIDs.length > 0 ? `${unselectIDs.length} items unselected due to stock issues` : 'All items in stock',
        items: results
    };
};

module.exports = { addToCart, getCart, removeCartItem, addCartCombo, updateCartItemsSelected, updateCartItemQuantityWithStockCheck, autoUpdateCartSelection };
