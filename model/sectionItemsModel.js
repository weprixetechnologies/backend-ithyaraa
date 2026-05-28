const db = require('../utils/dbconnect');

const createItem = async ({ itemId, type, orderIndex = 0 }) => {
  try {
    const [result] = await db.query(
      `INSERT INTO section_items (itemId, type, orderIndex) VALUES (?, ?, ?)`,
      [itemId, type, orderIndex]
    );
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error('sectionItemsModel.createItem error', error);
    return { success: false, error: error.message };
  }
};

const listItems = async ({ type = null } = {}) => {
  try {
    const rawType = typeof type === 'string' ? String(type).trim().toLowerCase() : null;

    // If no type specified, fetch all and enrich
    if (!rawType) {
      const [rows] = await db.query('SELECT * FROM section_items ORDER BY orderIndex ASC, id ASC');

      // --- imagesection enrichment ---
      const imagesectionItemIds = rows
        .filter(r => r.type && String(r.type).trim().toLowerCase() === 'imagesection')
        .map(r => r.itemId)
        .filter((v, i, a) => v !== null && v !== undefined && a.indexOf(v) === i);

      let imagesMap = {};
      let cisByItemId = {};

      if (imagesectionItemIds.length > 0) {
        const placeholders = imagesectionItemIds.map(() => '?').join(',');
        const [cis] = await db.query(
          `SELECT * FROM custom_image_sections WHERE sectionID IN (${placeholders})`,
          imagesectionItemIds
        );

        const cisIds = [];
        cis.forEach(c => {
          cisByItemId[c.sectionID] = c;
          cisIds.push(c.id);
        });

        if (cisIds.length > 0) {
          const ph = cisIds.map(() => '?').join(',');
          const [images] = await db.query(
            `SELECT * FROM section_images WHERE section_id IN (${ph}) ORDER BY position ASC`,
            cisIds
          );
          imagesMap = images.reduce((acc, img) => {
            let parsedFilters = img.filters;
            try {
              if (typeof img.filters === 'string' && img.filters.trim().length > 0) {
                parsedFilters = JSON.parse(img.filters);
              }
            } catch (e) {
              parsedFilters = img.filters;
            }

            const parsedImg = { ...img, filters: parsedFilters };
            acc[img.section_id] = acc[img.section_id] || [];
            acc[img.section_id].push(parsedImg);
            return acc;
          }, {});
        }
      }

      // --- presalesection enrichment ---
      const presalesectionItemIds = rows
        .filter(r => r.type && (String(r.type).trim().toLowerCase() === 'presalesection' || String(r.type).trim().toLowerCase() === 'presale section'))
        .map(r => r.itemId)
        .filter((v, i, a) => v !== null && v !== undefined && a.indexOf(v) === i);

      let presalePgByItemId = {};
      let presaleGroupProductsMap = {};

      if (presalesectionItemIds.length > 0) {
        const placeholders = presalesectionItemIds.map(() => '?').join(',');
        const [pgs] = await db.query(
          `SELECT * FROM presale_section_groups WHERE sectionID IN (${placeholders})`,
          presalesectionItemIds
        );

        const pgIds = [];
        pgs.forEach(p => {
          presalePgByItemId[p.sectionID] = p;
          pgIds.push(p.id);
        });

        if (pgIds.length > 0) {
          const ph = pgIds.map(() => '?').join(',');
          const [groupProducts] = await db.query(
            `SELECT gp.groupID, gp.presaleProductID, gp.position,
                    p.name AS productName, p.presaleProductID AS prodPresaleProductID, p.regularPrice, p.salePrice,
                    p.featuredImage, p.brand AS brandName, p.type,
                    p.preSaleStartDate, p.preSaleEndDate, p.expectedDeliveryDate, p.earlyBirdDiscount, p.earlyBirdEndDate
             FROM presale_section_group_products gp
             LEFT JOIN presale_products p ON p.presaleProductID = gp.presaleProductID
             WHERE gp.groupID IN (${ph})
             ORDER BY gp.groupID, gp.position ASC`,
            pgIds
          );
          presaleGroupProductsMap = groupProducts.reduce((acc, gp) => {
            let parsedFeatured = gp.featuredImage;
            try {
              if (typeof gp.featuredImage === 'string' && gp.featuredImage.trim().length > 0) {
                parsedFeatured = JSON.parse(gp.featuredImage);
              }
            } catch (e) {
              parsedFeatured = gp.featuredImage;
            }

            acc[gp.groupID] = acc[gp.groupID] || [];
            acc[gp.groupID].push({
              productID: gp.presaleProductID,
              position: gp.position,
              name: gp.productName,
              productID_external: gp.prodPresaleProductID,
              regularPrice: gp.regularPrice,
              salePrice: gp.salePrice,
              offerID: null,
              featuredImage: parsedFeatured,
              brandName: gp.brandName,
              type: gp.type || 'presale',
              preSaleStartDate: gp.preSaleStartDate,
              preSaleEndDate: gp.preSaleEndDate,
              expectedDeliveryDate: gp.expectedDeliveryDate,
              earlyBirdDiscount: gp.earlyBirdDiscount,
              earlyBirdEndDate: gp.earlyBirdEndDate
            });
            return acc;
          }, {});
        }
      }

      // --- productsection enrichment ---
      const productsectionItemIds = rows
        .filter(r => r.type && String(r.type).trim().toLowerCase() === 'productsection')
        .map(r => r.itemId)
        .filter((v, i, a) => v !== null && v !== undefined && a.indexOf(v) === i);

      let pgByItemId = {};
      let groupProductsMap = {};

      if (productsectionItemIds.length > 0) {
        const placeholders = productsectionItemIds.map(() => '?').join(',');
        const [pgs] = await db.query(
          `SELECT * FROM product_groups WHERE sectionID IN (${placeholders})`,
          productsectionItemIds
        );

        const pgIds = [];
        pgs.forEach(p => {
          pgByItemId[p.sectionID] = p;
          pgIds.push(p.id);
        });

        if (pgIds.length > 0) {
          const ph = pgIds.map(() => '?').join(',');
          const [groupProducts] = await db.query(
            `SELECT gp.groupID, gp.productID, gp.position,
                    p.name AS productName, p.productID AS prodProductID, p.regularPrice, p.salePrice,
                    p.offerID, p.featuredImage, p.brand AS brandName, p.type
             FROM group_products gp
             LEFT JOIN products p ON p.productID = gp.productID
             WHERE gp.groupID IN (${ph})
             ORDER BY gp.groupID, gp.position ASC`,
            pgIds
          );
          groupProductsMap = groupProducts.reduce((acc, gp) => {
            let parsedFeatured = gp.featuredImage;
            try {
              if (typeof gp.featuredImage === 'string' && gp.featuredImage.trim().length > 0) {
                parsedFeatured = JSON.parse(gp.featuredImage);
              }
            } catch (e) {
              parsedFeatured = gp.featuredImage;
            }

            acc[gp.groupID] = acc[gp.groupID] || [];
            acc[gp.groupID].push({
              productID: gp.productID,
              position: gp.position,
              name: gp.productName,
              productID_external: gp.prodProductID,
              regularPrice: gp.regularPrice,
              salePrice: gp.salePrice,
              offerID: gp.offerID,
              featuredImage: parsedFeatured,
              brandName: gp.brandName,
              type: gp.type
            });
            return acc;
          }, {});
        }
      }

      // --- combosection enrichment ---
      const combosectionItemIds = rows
        .filter(r => r.type && String(r.type).trim().toLowerCase() === 'combosection')
        .map(r => r.itemId)
        .filter((v, i, a) => v !== null && v !== undefined && a.indexOf(v) === i);

      let comboPgByItemId = {};
      let comboGroupProductsMap = {};

      if (combosectionItemIds.length > 0) {
        const placeholders = combosectionItemIds.map(() => '?').join(',');
        const [pgs] = await db.query(
          `SELECT * FROM combo_section_groups WHERE sectionID IN (${placeholders})`,
          combosectionItemIds
        );

        const pgIds = [];
        pgs.forEach(p => {
          comboPgByItemId[p.sectionID] = p;
          pgIds.push(p.id);
        });

        if (pgIds.length > 0) {
          const ph = pgIds.map(() => '?').join(',');
          const [groupProducts] = await db.query(
            `SELECT gp.groupID, gp.comboProductID, gp.position,
                    p.name AS productName, p.productID AS prodProductID, p.regularPrice, p.salePrice,
                    p.offerID, p.featuredImage, p.brand AS brandName, p.type
             FROM combo_section_group_products gp
             LEFT JOIN products p ON p.productID = gp.comboProductID
             WHERE gp.groupID IN (${ph})
             ORDER BY gp.groupID, gp.position ASC`,
            pgIds
          );

          const comboProductIDs = groupProducts.map(gp => gp.comboProductID).filter(Boolean);
          let comboItemsMap = {};
          if (comboProductIDs.length > 0) {
            const phCombo = comboProductIDs.map(() => '?').join(',');
            const [cItems] = await db.query(
              `SELECT ci.comboID, ci.productID, ci.productName, ci.featuredImage,
                      p.regularPrice, p.salePrice, p.type, p.status, p.brand
               FROM combo_item ci
               LEFT JOIN products p ON p.productID = ci.productID
               WHERE ci.comboID IN (${phCombo})`,
              comboProductIDs
            );

            const childProductIDs = cItems.map(ci => ci.productID).filter(Boolean);
            let childVariationsMap = {};
            if (childProductIDs.length > 0) {
              const phChild = childProductIDs.map(() => '?').join(',');
              const [vars] = await db.query(
                `SELECT * FROM variations WHERE productID IN (${phChild})`,
                childProductIDs
              );
              vars.forEach(v => {
                let parsedVals = v.variationValues;
                try {
                  if (typeof v.variationValues === 'string') parsedVals = JSON.parse(v.variationValues);
                } catch(e) {}
                childVariationsMap[v.productID] = childVariationsMap[v.productID] || [];
                childVariationsMap[v.productID].push({ ...v, variationValues: parsedVals });
              });
            }

            cItems.forEach(ci => {
              let parsedImg = ci.featuredImage;
              try {
                if (typeof ci.featuredImage === 'string') parsedImg = JSON.parse(ci.featuredImage);
              } catch(e) {}
              
              comboItemsMap[ci.comboID] = comboItemsMap[ci.comboID] || [];
              comboItemsMap[ci.comboID].push({
                productID: ci.productID,
                name: ci.productName,
                featuredImage: parsedImg,
                regularPrice: ci.regularPrice,
                salePrice: ci.salePrice,
                type: ci.type,
                status: ci.status,
                brand: ci.brand,
                variations: childVariationsMap[ci.productID] || []
              });
            });
          }

          comboGroupProductsMap = groupProducts.reduce((acc, gp) => {
            let parsedFeatured = gp.featuredImage;
            try {
              if (typeof gp.featuredImage === 'string' && gp.featuredImage.trim().length > 0) {
                parsedFeatured = JSON.parse(gp.featuredImage);
              }
            } catch (e) {
              parsedFeatured = gp.featuredImage;
            }

            acc[gp.groupID] = acc[gp.groupID] || [];
            acc[gp.groupID].push({
              productID: gp.comboProductID,
              position: gp.position,
              name: gp.productName,
              productID_external: gp.prodProductID,
              regularPrice: gp.regularPrice,
              salePrice: gp.salePrice,
              offerID: gp.offerID,
              featuredImage: parsedFeatured,
              brandName: gp.brandName,
              type: gp.type || 'combo',
              products: comboItemsMap[gp.comboProductID] || []
            });
            return acc;
          }, {});
        }
      }

      // --- featuredcoupon enrichment ---
      const featuredcouponItemIds = rows
        .filter(r => r.type && String(r.type).trim().toLowerCase() === 'featuredcoupon')
        .map(r => r.itemId)
        .filter((v, i, a) => v !== null && v !== undefined && a.indexOf(v) === i);

      let fcByItemId = {};

      if (featuredcouponItemIds.length > 0) {
        const numericIds = featuredcouponItemIds.map(Number).filter(n => !isNaN(n));
        if (numericIds.length > 0) {
          const placeholders = numericIds.map(() => '?').join(',');
          const [fcs] = await db.query(
            `SELECT * FROM featured_coupons WHERE id IN (${placeholders})`,
            numericIds
          );
          fcs.forEach(fc => {
            fcByItemId[String(fc.id)] = fc;
          });
        }
      }

      const enriched = rows.map(r => {
        const t = r.type ? String(r.type).trim().toLowerCase() : null;
        if (t === 'imagesection') {
          const cis = cisByItemId[r.itemId] || null;
          return {
            ...r,
            section: cis ? {
              id: cis.id,
              sectionID: cis.sectionID,
              title: cis.title,
              imageUrl: cis.imageUrl,
              layoutID: cis.layoutID,
              isBannerised: cis.isBannerised,
              createdAt: cis.createdAt,
              updatedAt: cis.updatedAt
            } : null,
            images: cis ? (imagesMap[cis.id] || []) : []
          };
        } else if (t === 'presalesection' || t === 'presale section') {
          const pg = presalePgByItemId[r.itemId] || null;
          return {
            ...r,
            group: pg ? {
              id: pg.id,
              sectionID: pg.sectionID,
              title: pg.title,
              orderIndex: pg.orderIndex,
              imageUrl: pg.imageUrl,
              isBannerised: pg.isBannerised,
              createdAt: pg.createdAt,
              updatedAt: pg.updatedAt
            } : null,
            products: pg ? (presaleGroupProductsMap[pg.id] || []) : []
          };
        } else if (t === 'productsection') {
          const pg = pgByItemId[r.itemId] || null;
          let parsedFilters = null;
          if (pg && pg.filters) {
            try {
              parsedFilters = typeof pg.filters === 'string' ? JSON.parse(pg.filters) : pg.filters;
            } catch(e) {
              parsedFilters = pg.filters;
            }
          }
          return {
            ...r,
            group: pg ? {
              id: pg.id,
              sectionID: pg.sectionID,
              title: pg.title,
              orderIndex: pg.orderIndex,
              imageUrl: pg.imageUrl,
              isBannerised: pg.isBannerised,
              routeTo: pg.routeTo,
              filters: parsedFilters,
              createdAt: pg.createdAt,
              updatedAt: pg.updatedAt
            } : null,
            products: pg ? (groupProductsMap[pg.id] || []) : []
          };
        } else if (t === 'combosection') {
          const pg = comboPgByItemId[r.itemId] || null;
          return {
            ...r,
            group: pg ? {
              id: pg.id,
              sectionID: pg.sectionID,
              title: pg.title,
              orderIndex: pg.orderIndex,
              imageUrl: pg.imageUrl,
              isBannerised: pg.isBannerised,
              createdAt: pg.createdAt,
              updatedAt: pg.updatedAt
            } : null,
            products: pg ? (comboGroupProductsMap[pg.id] || []) : []
          };
        } else if (t === 'featuredcoupon') {
          const fc = fcByItemId[String(r.itemId)] || null;
          return {
            ...r,
            coupon: fc ? {
              id: fc.id,
              popupImage: fc.popupImage,
              iconImage: fc.iconImage,
              couponCode: fc.couponCode,
              isActive: Boolean(fc.isActive),
              createdAt: fc.createdAt,
              updatedAt: fc.updatedAt
            } : null
          };
        }
        return r;
      });

      return { success: true, data: enriched };
    }

    // specific type filters (case-insensitive)
    if (rawType === 'imagesection') {
      const [rows] = await db.query(
        `SELECT si.id AS entryId, si.type, si.orderIndex, si.itemId,
                cis.id AS cis_id, cis.sectionID AS cis_sectionID, cis.title AS cis_title,
                cis.imageUrl AS cis_imageUrl, cis.layoutID AS cis_layoutID, cis.isBannerised AS cis_isBannerised,
                cis.createdAt AS cis_createdAt, cis.updatedAt AS cis_updatedAt
         FROM section_items si
         LEFT JOIN custom_image_sections cis ON cis.sectionID = si.itemId
         WHERE LOWER(si.type) = ?
         ORDER BY si.orderIndex ASC`,
        [rawType]
      );

      const cisIds = rows.map(r => r.cis_id).filter(id => id !== null && id !== undefined);
      let imagesMap = {};
      if (cisIds.length > 0) {
        const placeholders = cisIds.map(() => '?').join(',');
        const [images] = await db.query(
          `SELECT * FROM section_images WHERE section_id IN (${placeholders}) ORDER BY position ASC`,
          cisIds
        );
        imagesMap = images.reduce((acc, img) => {
          let parsedFilters = img.filters;
          try {
            if (typeof img.filters === 'string' && img.filters.trim().length > 0) {
              parsedFilters = JSON.parse(img.filters);
            }
          } catch (e) {
            parsedFilters = img.filters;
          }
          const parsedImg = { ...img, filters: parsedFilters };
          acc[img.section_id] = acc[img.section_id] || [];
          acc[img.section_id].push(parsedImg);
          return acc;
        }, {});
      }

      const enriched = rows.map(r => ({
        entryId: r.entryId,
        type: r.type,
        orderIndex: r.orderIndex,
        itemId: r.itemId,
        section: r.cis_id ? {
          id: r.cis_id,
          sectionID: r.cis_sectionID,
          title: r.cis_title,
          imageUrl: r.cis_imageUrl,
          layoutID: r.cis_layoutID,
          isBannerised: r.cis_isBannerised,
          createdAt: r.cis_createdAt,
          updatedAt: r.cis_updatedAt
        } : null,
        images: r.cis_id ? (imagesMap[r.cis_id] || []) : []
      }));

      return { success: true, data: enriched };
    } else if (rawType === 'productsection' || rawType === 'product section') {
      const [rows] = await db.query(
        `SELECT si.id AS entryId, si.type, si.orderIndex, si.itemId,
                pg.id AS pg_id, pg.sectionID AS pg_sectionID, pg.title AS pg_title, pg.orderIndex AS pg_orderIndex,
                pg.imageUrl AS pg_imageUrl, pg.isBannerised AS pg_isBannerised, pg.routeTo AS pg_routeTo, pg.filters AS pg_filters,
                pg.createdAt AS pg_createdAt, pg.updatedAt AS pg_updatedAt
         FROM section_items si
         LEFT JOIN product_groups pg ON pg.sectionID = si.itemId
         WHERE LOWER(si.type) = ?
         ORDER BY si.orderIndex ASC`,
        [rawType]
      );

      const pgIds = rows.map(r => r.pg_id).filter(id => id !== null && id !== undefined);
      let groupProductsMap = {};
      if (pgIds.length > 0) {
        const placeholders = pgIds.map(() => '?').join(',');
        const [groupProducts] = await db.query(
          `SELECT gp.groupID, gp.productID, gp.position,
                  p.name AS productName, p.productID AS prodProductID, p.regularPrice, p.salePrice,
                  p.offerID, p.featuredImage, p.brand AS brandName, p.type
           FROM group_products gp
           LEFT JOIN products p ON p.productID = gp.productID
           WHERE gp.groupID IN (${placeholders})
           ORDER BY gp.groupID, gp.position ASC`,
          pgIds
        );
        groupProductsMap = groupProducts.reduce((acc, gp) => {
          let parsedFeatured = gp.featuredImage;
          try {
            if (typeof gp.featuredImage === 'string' && gp.featuredImage.trim().length > 0) {
              parsedFeatured = JSON.parse(gp.featuredImage);
            }
          } catch (e) {
            parsedFeatured = gp.featuredImage;
          }

          acc[gp.groupID] = acc[gp.groupID] || [];
          acc[gp.groupID].push({
            productID: gp.productID,
            position: gp.position,
            name: gp.productName,
            productID_external: gp.prodProductID,
            regularPrice: gp.regularPrice,
            salePrice: gp.salePrice,
            offerID: gp.offerID,
            featuredImage: parsedFeatured,
            brandName: gp.brandName,
            type: gp.type
          });
          return acc;
        }, {});
      }

      const enriched = rows.map(r => {
        let parsedFilters = null;
        if (r.pg_filters) {
          try {
            parsedFilters = typeof r.pg_filters === 'string' ? JSON.parse(r.pg_filters) : r.pg_filters;
          } catch(e) {
            parsedFilters = r.pg_filters;
          }
        }
        return {
          entryId: r.entryId,
          type: r.type,
          orderIndex: r.orderIndex,
          itemId: r.itemId,
          group: r.pg_id ? {
            id: r.pg_id,
            sectionID: r.pg_sectionID,
            title: r.pg_title,
            orderIndex: r.pg_orderIndex,
            imageUrl: r.pg_imageUrl,
            isBannerised: r.pg_isBannerised,
            routeTo: r.pg_routeTo,
            filters: parsedFilters,
            createdAt: r.pg_createdAt,
            updatedAt: r.pg_updatedAt
          } : null,
          products: r.pg_id ? (groupProductsMap[r.pg_id] || []) : []
        };
      });

      return { success: true, data: enriched };
    } else if (rawType === 'combosection') {
      const [rows] = await db.query(
        `SELECT si.id AS entryId, si.type, si.orderIndex, si.itemId,
                pg.id AS pg_id, pg.sectionID AS pg_sectionID, pg.title AS pg_title, pg.orderIndex AS pg_orderIndex,
                pg.imageUrl AS pg_imageUrl, pg.isBannerised AS pg_isBannerised,
                pg.createdAt AS pg_createdAt, pg.updatedAt AS pg_updatedAt
         FROM section_items si
         LEFT JOIN combo_section_groups pg ON pg.sectionID = si.itemId
         WHERE LOWER(si.type) = ?
         ORDER BY si.orderIndex ASC`,
        [rawType]
      );

      const pgIds = rows.map(r => r.pg_id).filter(id => id !== null && id !== undefined);
      let comboGroupProductsMap = {};
      if (pgIds.length > 0) {
        const placeholders = pgIds.map(() => '?').join(',');
        const [groupProducts] = await db.query(
          `SELECT gp.groupID, gp.comboProductID, gp.position,
                  p.name AS productName, p.productID AS prodProductID, p.regularPrice, p.salePrice,
                  p.offerID, p.featuredImage, p.brand AS brandName, p.type
           FROM combo_section_group_products gp
           LEFT JOIN products p ON p.productID = gp.comboProductID
           WHERE gp.groupID IN (${placeholders})
           ORDER BY gp.groupID, gp.position ASC`,
          pgIds
        );

        const comboProductIDs = groupProducts.map(gp => gp.comboProductID).filter(Boolean);
        let comboItemsMap = {};
        if (comboProductIDs.length > 0) {
          const phCombo = comboProductIDs.map(() => '?').join(',');
          const [cItems] = await db.query(
            `SELECT ci.comboID, ci.productID, ci.productName, ci.featuredImage,
                    p.regularPrice, p.salePrice, p.type, p.status, p.brand
             FROM combo_item ci
             LEFT JOIN products p ON p.productID = ci.productID
             WHERE ci.comboID IN (${phCombo})`,
            comboProductIDs
          );

          const childProductIDs = cItems.map(ci => ci.productID).filter(Boolean);
          let childVariationsMap = {};
          if (childProductIDs.length > 0) {
            const phChild = childProductIDs.map(() => '?').join(',');
            const [vars] = await db.query(
              `SELECT * FROM variations WHERE productID IN (${phChild})`,
              childProductIDs
            );
            vars.forEach(v => {
              let parsedVals = v.variationValues;
              try {
                if (typeof v.variationValues === 'string') parsedVals = JSON.parse(v.variationValues);
              } catch(e) {}
              childVariationsMap[v.productID] = childVariationsMap[v.productID] || [];
              childVariationsMap[v.productID].push({ ...v, variationValues: parsedVals });
            });
          }

          cItems.forEach(ci => {
            let parsedImg = ci.featuredImage;
            try {
              if (typeof ci.featuredImage === 'string') parsedImg = JSON.parse(ci.featuredImage);
            } catch(e) {}
            
            comboItemsMap[ci.comboID] = comboItemsMap[ci.comboID] || [];
            comboItemsMap[ci.comboID].push({
              productID: ci.productID,
              name: ci.productName,
              featuredImage: parsedImg,
              regularPrice: ci.regularPrice,
              salePrice: ci.salePrice,
              type: ci.type,
              status: ci.status,
              brand: ci.brand,
              variations: childVariationsMap[ci.productID] || []
            });
          });
        }

        comboGroupProductsMap = groupProducts.reduce((acc, gp) => {
          let parsedFeatured = gp.featuredImage;
          try {
            if (typeof gp.featuredImage === 'string' && gp.featuredImage.trim().length > 0) {
              parsedFeatured = JSON.parse(gp.featuredImage);
            }
          } catch (e) {
            parsedFeatured = gp.featuredImage;
          }

          acc[gp.groupID] = acc[gp.groupID] || [];
          acc[gp.groupID].push({
            productID: gp.comboProductID,
            position: gp.position,
            name: gp.productName,
            productID_external: gp.prodProductID,
            regularPrice: gp.regularPrice,
            salePrice: gp.salePrice,
            offerID: gp.offerID,
            featuredImage: parsedFeatured,
            brandName: gp.brandName,
            type: gp.type || 'combo',
            products: comboItemsMap[gp.comboProductID] || []
          });
          return acc;
        }, {});
      }

      const enriched = rows.map(r => ({
        entryId: r.entryId,
        type: r.type,
        orderIndex: r.orderIndex,
        itemId: r.itemId,
        group: r.pg_id ? {
          id: r.pg_id,
          sectionID: r.pg_sectionID,
          title: r.pg_title,
          orderIndex: r.pg_orderIndex,
          imageUrl: r.pg_imageUrl,
          isBannerised: r.pg_isBannerised,
          createdAt: r.pg_createdAt,
          updatedAt: r.pg_updatedAt
        } : null,
        products: r.pg_id ? (comboGroupProductsMap[r.pg_id] || []) : []
      }));

      return { success: true, data: enriched };
    } else if (rawType === 'presalesection' || rawType === 'presale section') {
      const [rows] = await db.query(
        `SELECT si.id AS entryId, si.type, si.orderIndex, si.itemId,
                pg.id AS pg_id, pg.sectionID AS pg_sectionID, pg.title AS pg_title, pg.orderIndex AS pg_orderIndex,
                pg.imageUrl AS pg_imageUrl, pg.isBannerised AS pg_isBannerised,
                pg.createdAt AS pg_createdAt, pg.updatedAt AS pg_updatedAt
         FROM section_items si
         LEFT JOIN presale_section_groups pg ON pg.sectionID = si.itemId
         WHERE LOWER(si.type) = ?
         ORDER BY si.orderIndex ASC`,
        [rawType]
      );

      const pgIds = rows.map(r => r.pg_id).filter(id => id !== null && id !== undefined);
      let groupProductsMap = {};
      if (pgIds.length > 0) {
        const placeholders = pgIds.map(() => '?').join(',');
        const [groupProducts] = await db.query(
          `SELECT gp.groupID, gp.presaleProductID, gp.position,
                  p.name AS productName, p.presaleProductID AS prodPresaleProductID, p.regularPrice, p.salePrice,
                  p.featuredImage, p.brand AS brandName, p.type,
                  p.preSaleStartDate, p.preSaleEndDate, p.expectedDeliveryDate, p.earlyBirdDiscount, p.earlyBirdEndDate
           FROM presale_section_group_products gp
           LEFT JOIN presale_products p ON p.presaleProductID = gp.presaleProductID
           WHERE gp.groupID IN (${placeholders})
           ORDER BY gp.groupID, gp.position ASC`,
          pgIds
        );
        groupProductsMap = groupProducts.reduce((acc, gp) => {
          let parsedFeatured = gp.featuredImage;
          try {
            if (typeof gp.featuredImage === 'string' && gp.featuredImage.trim().length > 0) {
              parsedFeatured = JSON.parse(gp.featuredImage);
            }
          } catch (e) {
            parsedFeatured = gp.featuredImage;
          }

          acc[gp.groupID] = acc[gp.groupID] || [];
          acc[gp.groupID].push({
            productID: gp.presaleProductID,
            position: gp.position,
            name: gp.productName,
            productID_external: gp.prodPresaleProductID,
            regularPrice: gp.regularPrice,
            salePrice: gp.salePrice,
            offerID: null,
            featuredImage: parsedFeatured,
            brandName: gp.brandName,
            type: gp.type || 'presale',
            preSaleStartDate: gp.preSaleStartDate,
            preSaleEndDate: gp.preSaleEndDate,
            expectedDeliveryDate: gp.expectedDeliveryDate,
            earlyBirdDiscount: gp.earlyBirdDiscount,
            earlyBirdEndDate: gp.earlyBirdEndDate
          });
          return acc;
        }, {});
      }

      const enriched = rows.map(r => ({
        entryId: r.entryId,
        type: r.type,
        orderIndex: r.orderIndex,
        itemId: r.itemId,
        group: r.pg_id ? {
          id: r.pg_id,
          sectionID: r.pg_sectionID,
          title: r.pg_title,
          orderIndex: r.pg_orderIndex,
          imageUrl: r.pg_imageUrl,
          isBannerised: r.pg_isBannerised,
          createdAt: r.pg_createdAt,
          updatedAt: r.pg_updatedAt
        } : null,
        products: r.pg_id ? (groupProductsMap[r.pg_id] || []) : []
      }));

      return { success: true, data: enriched };
    } else if (rawType === 'featuredcoupon') {
      const [rows] = await db.query(
        `SELECT * FROM section_items WHERE LOWER(type) = ? ORDER BY orderIndex ASC`,
        [rawType]
      );

      const numericIds = rows.map(r => Number(r.itemId)).filter(n => !isNaN(n));
      let fcMap = {};
      if (numericIds.length > 0) {
        const placeholders = numericIds.map(() => '?').join(',');
        const [fcs] = await db.query(
          `SELECT * FROM featured_coupons WHERE id IN (${placeholders})`,
          numericIds
        );
        fcs.forEach(fc => { fcMap[String(fc.id)] = fc; });
      }

      const enriched = rows.map(r => {
        const fc = fcMap[String(r.itemId)] || null;
        return {
          entryId: r.id,
          type: r.type,
          orderIndex: r.orderIndex,
          itemId: r.itemId,
          coupon: fc ? {
            id: fc.id,
            popupImage: fc.popupImage,
            iconImage: fc.iconImage,
            couponCode: fc.couponCode,
            isActive: Boolean(fc.isActive),
            createdAt: fc.createdAt,
            updatedAt: fc.updatedAt
          } : null
        };
      });

      return { success: true, data: enriched };
    } else {
      const [rows] = await db.query('SELECT * FROM section_items WHERE type = ? ORDER BY orderIndex ASC', [type]);
      return { success: true, data: rows };
    }
  } catch (error) {
    console.error('sectionItemsModel.listItems error', error);
    return { success: false, error: error.message };
  }
};

const reorderItems = async (items = []) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const it of items) {
      const iid = it.id;
      const idx = parseInt(it.orderIndex, 10) || 0;
      await connection.query('UPDATE section_items SET orderIndex = ? WHERE id = ?', [idx, iid]);
    }
    await connection.commit();
    connection.release();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('sectionItemsModel.reorderItems error', error);
    return { success: false, error: error.message };
  }
};

const getItemById = async (id) => {
  try {
    const [rows] = await db.query('SELECT * FROM section_items WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return { success: false, message: 'Not found' };
    const r = rows[0];
    const t = r.type ? String(r.type).trim().toLowerCase() : null;

    if (t === 'imagesection') {
      const [cisRows] = await db.query('SELECT * FROM custom_image_sections WHERE sectionID = ? LIMIT 1', [r.itemId]);
      const cis = cisRows && cisRows[0] ? cisRows[0] : null;
      let images = [];
      if (cis) {
        const [imgRows] = await db.query('SELECT * FROM section_images WHERE section_id = ? ORDER BY position ASC', [cis.id]);
        images = imgRows.map(img => {
          let parsedFilters = img.filters;
          try {
            if (typeof img.filters === 'string' && img.filters.trim().length > 0) parsedFilters = JSON.parse(img.filters);
          } catch (e) {
            parsedFilters = img.filters;
          }
          return { ...img, filters: parsedFilters };
        });
      }
      return { success: true, data: { ...r, section: cis, images } };
    } else if (t === 'productsection' || t === 'product section') {
      const [pgRows] = await db.query('SELECT * FROM product_groups WHERE sectionID = ? LIMIT 1', [r.itemId]);
      const pg = pgRows && pgRows[0] ? pgRows[0] : null;
      let products = [];
      if (pg) {
        const [groupProducts] = await db.query(
          `SELECT gp.groupID, gp.productID, gp.position,
                  p.name AS productName, p.productID AS prodProductID, p.regularPrice, p.salePrice,
                  p.offerID, p.featuredImage, p.brand AS brandName, p.type
           FROM group_products gp
           LEFT JOIN products p ON p.productID = gp.productID
           WHERE gp.groupID = ?
           ORDER BY gp.position ASC`,
          [pg.id]
        );
        products = groupProducts.map(gp => {
          let parsedFeatured = gp.featuredImage;
          try {
            if (typeof gp.featuredImage === 'string' && gp.featuredImage.trim().length > 0) parsedFeatured = JSON.parse(gp.featuredImage);
          } catch (e) {
            parsedFeatured = gp.featuredImage;
          }
          return {
            productID: gp.productID,
            position: gp.position,
            name: gp.productName,
            productID_external: gp.prodProductID,
            regularPrice: gp.regularPrice,
            salePrice: gp.salePrice,
            offerID: gp.offerID,
            featuredImage: parsedFeatured,
            brandName: gp.brandName,
            type: gp.type
          };
        });
      }
      return { success: true, data: { ...r, group: pg, products } };
    } else if (t === 'presalesection' || t === 'presale section') {
      const [pgRows] = await db.query('SELECT * FROM presale_section_groups WHERE sectionID = ? LIMIT 1', [r.itemId]);
      const pg = pgRows && pgRows[0] ? pgRows[0] : null;
      let products = [];
      if (pg) {
        const [groupProducts] = await db.query(
          `SELECT gp.groupID, gp.presaleProductID, gp.position,
                  p.name AS productName, p.presaleProductID AS prodPresaleProductID, p.regularPrice, p.salePrice,
                  p.featuredImage, p.brand AS brandName, p.type,
                  p.preSaleStartDate, p.preSaleEndDate, p.expectedDeliveryDate, p.earlyBirdDiscount, p.earlyBirdEndDate
           FROM presale_section_group_products gp
           LEFT JOIN presale_products p ON p.presaleProductID = gp.presaleProductID
           WHERE gp.groupID = ?
           ORDER BY gp.position ASC`,
          [pg.id]
        );
        products = groupProducts.map(gp => {
          let parsedFeatured = gp.featuredImage;
          try {
            if (typeof gp.featuredImage === 'string' && gp.featuredImage.trim().length > 0) parsedFeatured = JSON.parse(gp.featuredImage);
          } catch (e) {
            parsedFeatured = gp.featuredImage;
          }
          return {
            productID: gp.presaleProductID,
            position: gp.position,
            name: gp.productName,
            productID_external: gp.prodPresaleProductID,
            regularPrice: gp.regularPrice,
            salePrice: gp.salePrice,
            offerID: null,
            featuredImage: parsedFeatured,
            brandName: gp.brandName,
            type: gp.type || 'presale',
            preSaleStartDate: gp.preSaleStartDate,
            preSaleEndDate: gp.preSaleEndDate,
            expectedDeliveryDate: gp.expectedDeliveryDate,
            earlyBirdDiscount: gp.earlyBirdDiscount,
            earlyBirdEndDate: gp.earlyBirdEndDate
          };
        });
      }
      return { success: true, data: { ...r, group: pg, products } };
    } else if (t === 'combosection') {
      const [pgRows] = await db.query('SELECT * FROM combo_section_groups WHERE sectionID = ? LIMIT 1', [r.itemId]);
      const pg = pgRows && pgRows[0] ? pgRows[0] : null;
      let products = [];
      if (pg) {
        const [groupProducts] = await db.query(
          `SELECT gp.groupID, gp.comboProductID, gp.position,
                  p.name AS productName, p.productID AS prodProductID, p.regularPrice, p.salePrice,
                  p.offerID, p.featuredImage, p.brand AS brandName, p.type
           FROM combo_section_group_products gp
           LEFT JOIN products p ON p.productID = gp.comboProductID
           WHERE gp.groupID = ?
           ORDER BY gp.position ASC`,
          [pg.id]
        );

        const comboProductIDs = groupProducts.map(gp => gp.comboProductID).filter(Boolean);
        let comboItemsMap = {};
        if (comboProductIDs.length > 0) {
          const phCombo = comboProductIDs.map(() => '?').join(',');
          const [cItems] = await db.query(
            `SELECT ci.comboID, ci.productID, ci.productName, ci.featuredImage,
                    p.regularPrice, p.salePrice, p.type, p.status, p.brand
             FROM combo_item ci
             LEFT JOIN products p ON p.productID = ci.productID
             WHERE ci.comboID IN (${phCombo})`,
            comboProductIDs
          );

          const childProductIDs = cItems.map(ci => ci.productID).filter(Boolean);
          let childVariationsMap = {};
          if (childProductIDs.length > 0) {
            const phChild = childProductIDs.map(() => '?').join(',');
            const [vars] = await db.query(
              `SELECT * FROM variations WHERE productID IN (${phChild})`,
              childProductIDs
            );
            vars.forEach(v => {
              let parsedVals = v.variationValues;
              try {
                if (typeof v.variationValues === 'string') parsedVals = JSON.parse(v.variationValues);
              } catch(e) {}
              childVariationsMap[v.productID] = childVariationsMap[v.productID] || [];
              childVariationsMap[v.productID].push({ ...v, variationValues: parsedVals });
            });
          }

          cItems.forEach(ci => {
            let parsedImg = ci.featuredImage;
            try {
              if (typeof ci.featuredImage === 'string') parsedImg = JSON.parse(ci.featuredImage);
            } catch(e) {}
            
            comboItemsMap[ci.comboID] = comboItemsMap[ci.comboID] || [];
            comboItemsMap[ci.comboID].push({
              productID: ci.productID,
              name: ci.productName,
              featuredImage: parsedImg,
              regularPrice: ci.regularPrice,
              salePrice: ci.salePrice,
              type: ci.type,
              status: ci.status,
              brand: ci.brand,
              variations: childVariationsMap[ci.productID] || []
            });
          });
        }

        products = groupProducts.map(gp => {
          let parsedFeatured = gp.featuredImage;
          try {
            if (typeof gp.featuredImage === 'string' && gp.featuredImage.trim().length > 0) parsedFeatured = JSON.parse(gp.featuredImage);
          } catch (e) {
            parsedFeatured = gp.featuredImage;
          }
          return {
            productID: gp.comboProductID,
            position: gp.position,
            name: gp.productName,
            productID_external: gp.prodProductID,
            regularPrice: gp.regularPrice,
            salePrice: gp.salePrice,
            offerID: gp.offerID,
            featuredImage: parsedFeatured,
            brandName: gp.brandName,
            type: gp.type || 'combo',
            products: comboItemsMap[gp.comboProductID] || []
          };
        });
      }
      return { success: true, data: { ...r, group: pg, products } };
    } else if (t === 'featuredcoupon') {
      const numId = Number(r.itemId);
      let coupon = null;
      if (!isNaN(numId)) {
        const [fcRows] = await db.query('SELECT * FROM featured_coupons WHERE id = ? LIMIT 1', [numId]);
        if (fcRows && fcRows[0]) {
          const fc = fcRows[0];
          coupon = {
            id: fc.id,
            popupImage: fc.popupImage,
            iconImage: fc.iconImage,
            couponCode: fc.couponCode,
            isActive: Boolean(fc.isActive),
            createdAt: fc.createdAt,
            updatedAt: fc.updatedAt
          };
        }
      }
      return { success: true, data: { ...r, coupon } };
    }

    return { success: true, data: r };
  } catch (error) {
    console.error('sectionItemsModel.getItemById error', error);
    return { success: false, error: error.message };
  }
};

const updateItem = async (id, { itemId, type, orderIndex } = {}) => {
  try {
    const updates = [];
    const values = [];
    if (itemId !== undefined) { updates.push('itemId = ?'); values.push(itemId); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (orderIndex !== undefined) { updates.push('orderIndex = ?'); values.push(orderIndex); }
    if (updates.length === 0) return { success: false, message: 'No fields to update' };
    values.push(id);
    const [result] = await db.query(`UPDATE section_items SET ${updates.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return { success: false, message: 'Not found' };
    return { success: true };
  } catch (error) {
    console.error('sectionItemsModel.updateItem error', error);
    return { success: false, error: error.message };
  }
};

const deleteItem = async (id) => {
  try {
    const [result] = await db.query('DELETE FROM section_items WHERE id = ?', [id]);
    if (result.affectedRows === 0) return { success: false, message: 'Not found' };
    return { success: true };
  } catch (error) {
    console.error('sectionItemsModel.deleteItem error', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  createItem,
  listItems,
  reorderItems,
  getItemById,
  updateItem,
  deleteItem
};
