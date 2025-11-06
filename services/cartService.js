const cartModel = require('../model/cartModel');
const db = require('./../utils/dbconnect');
const flashSaleModel = require('../model/flashSaleModel');

async function addToCart(uid, productID, quantity, variationID, variationName, referBy, customInputs) {
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

    return { cartItem, cartDetail: updatedCartDetail };
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
    const modified = await cartModel.getCartModifiedFlag(uid);

    if (modified === 1) {
        const items = await cartModel.getCartItems(uid);

        // Re-verify flash sale items, reset if expired. Also normalize base price per variation
        for (const item of items) {
            // Preserve combo parent pricing entirely
            if (item.productType === 'combo') {
                const comboItems = await cartModel.getComboItems(item.comboID);
                item.comboItems = comboItems;
                continue;
            }
            let base = null;
            if (item.variationID) {
                const v = await cartModel.getVariationByID(item.variationID);
                if (v) base = Number(v.variationSalePrice ?? v.variationPrice);
            }
            if (base === null || Number.isNaN(base)) base = Number(item.salePrice ?? item.regularPrice);

            if (item.isFlashSale) {
                const flash = await require('../model/flashSaleModel').getActiveFlashForProduct(item.productID);
                if (!flash) {
                    // expired → reset to variation/base
                    await cartModel.resetFlashForCartItem(item.cartItemID, base, item.quantity);
                    item.salePrice = null;
                    item.isFlashSale = 0;
                } else {
                    // active → compute flash price on top of variationPrice (not sale)
                    const v = item.variationID ? await cartModel.getVariationByID(item.variationID) : null;
                    const baseForFlash = v ? Number(v.variationPrice) : Number(item.regularPrice);
                    const dtype = String(flash.discountType || '').toLowerCase();
                    const dval = Number(flash.discountValue || 0);
                    if (!Number.isNaN(baseForFlash) && dval > 0) {
                        if (dtype === 'percentage') base = Math.max(0, +(baseForFlash * (1 - dval / 100)).toFixed(2));
                        else if (dtype === 'fixed') base = Math.max(0, +(baseForFlash - dval).toFixed(2));
                    } else {
                        base = baseForFlash;
                    }
                }
            }

            // set per-item base unit for totals
            item.unitPriceBefore = base;
            item.unitPriceAfter = base;
            item.lineTotalBefore = base * item.quantity;
            item.lineTotalAfter = base * item.quantity;

            const comboItems = await cartModel.getComboItems(item.comboID);
            item.comboItems = comboItems;
        }

        // Decide caching behavior based on presence of flash sale items
        const cart = await cartModel.getOrCreateCart(uid);
        const anyFlash = items.some(it => it.isFlashSale);
        let summary;
        if (anyFlash) {
            summary = await cartModel.updateCartTotals(cart.cartID);
            await cartModel.setCartModified(cart.cartID, true);
        } else {
            // No flash sale items → keep cart cached, set modified=0 and avoid recalculation
            await cartModel.setCartModified(cart.cartID, false);
            summary = await cartModel.getCartSummaryFromDB(uid);
        }
        if (cart && cart.referBy) items.forEach(i => { i.referBy = cart.referBy; });
        console.log('Fast path - returning cached cart');
        return { items, summary, cartID: cart.cartID };
    }

    let items = await cartModel.getCartItems(uid);
    let anyModifications = false;
    const processedOfferIDs = new Set();

    // Initialize item flags and parse prices; set base from variationSalePrice/variationPrice
    for (const item of items) {
        item.offerApplied = false;
        item.offerStatus = 'none';
        item.salePrice = Number(item.salePrice);
        item.regularPrice = Number(item.regularPrice);
        if (item.overridePrice != null) item.overridePrice = Number(item.overridePrice);

        // Skip recalculation for combo parent items
        if (item.productType === 'combo') {
            const comboItems = await cartModel.getComboItems(item.comboID);
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

        let base = null;
        if (item.variationID) {
            const v = await cartModel.getVariationByID(item.variationID);
            if (v) base = Number(v.variationSalePrice ?? v.variationPrice);
        }
        if (base === null || Number.isNaN(base)) base = Number(item.salePrice ?? item.regularPrice);

        // If flash sale flagged and active, recompute base from variationPrice with flash discount
        if (item.isFlashSale) {
            const flash = await require('../model/flashSaleModel').getActiveFlashForProduct(item.productID);
            if (!flash) {
                await cartModel.resetFlashForCartItem(item.cartItemID, base, item.quantity);
                item.salePrice = null;
                item.isFlashSale = 0;
            } else {
                const v = item.variationID ? await cartModel.getVariationByID(item.variationID) : null;
                const baseForFlash = v ? Number(v.variationPrice) : Number(item.regularPrice);
                const dtype = String(flash.discountType || '').toLowerCase();
                const dval = Number(flash.discountValue || 0);
                if (!Number.isNaN(baseForFlash) && dval > 0) {
                    if (dtype === 'percentage') base = Math.max(0, +(baseForFlash * (1 - dval / 100)).toFixed(2));
                    else if (dtype === 'fixed') base = Math.max(0, +(baseForFlash - dval).toFixed(2));
                } else {
                    base = baseForFlash;
                }
            }
        }

        item.unitPriceBefore = item.overridePrice ?? base;
        item.unitPriceAfter = item.unitPriceBefore;
        item.lineTotalBefore = item.unitPriceBefore * item.quantity;
        item.lineTotalAfter = item.unitPriceAfter * item.quantity;
        console.log(`[INIT] Item ${item.cartItemID}: base=${base}, unitPriceBefore=${item.unitPriceBefore}`);
    }

    // Re-verify flash sale items, reset if expired (slow path)
    // Note: This is redundant with the initialization loop above, but kept for safety
    for (const item of items) {
        if (item.isFlashSale) {
            const flash = await require('../model/flashSaleModel').getActiveFlashForProduct(item.productID);
            if (!flash) {
                // Get base from variation if available
                let base = null;
                if (item.variationID) {
                    const v = await cartModel.getVariationByID(item.variationID);
                    if (v) base = Number(v.variationSalePrice ?? v.variationPrice);
                }
                if (base === null || Number.isNaN(base)) base = Number(item.salePrice ?? item.regularPrice);

                await cartModel.resetFlashForCartItem(item.cartItemID, base, item.quantity);
                // Reflect reset in-memory so downstream totals and persistence update correctly
                item.salePrice = null;
                item.isFlashSale = 0;
                item.unitPriceBefore = base;
                item.unitPriceAfter = base;
                item.lineTotalBefore = base * item.quantity;
                item.lineTotalAfter = base * item.quantity;
            }
        }
    }

    // Offer processing
    for (const item of items) {
        const comboItems = await cartModel.getComboItems(item.comboID);
        item.comboItems = comboItems;

        if (!item.offerID || processedOfferIDs.has(item.offerID)) continue;

        const offer = await cartModel.getActiveOfferByID(item.offerID);
        const affectedItems = items.filter(i => i.offerID === item.offerID && i.productType !== 'combo');

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
    });


    const subtotal = items.reduce((sum, i) => sum + i.lineTotalBefore, 0);
    const total = items.reduce((sum, i) => sum + i.lineTotalAfter, 0);
    const totalDiscount = subtotal - total;

    const summary = { subtotal, total, totalDiscount, anyModifications };
    console.log(`[SUMMARY] subtotal=${subtotal}, total=${total}, totalDiscount=${totalDiscount}`);

    // Update DB
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


module.exports = { addToCart, getCart, removeCartItem, addCartCombo };
