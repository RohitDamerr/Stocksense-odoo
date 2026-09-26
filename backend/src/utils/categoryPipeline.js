'use strict';

const mongoose = require('mongoose');
const { getDescendantIds } = require('../services/category.service');

/**
 * Build the aggregation pipeline stages needed to filter documents by category
 * via their lines[].product.category reference.
 *
 * Returns an empty array when no category filter is needed (caller receives
 * undefined or null for categoryId).
 *
 * If the category id is provided but does not exist in the DB, returns null
 * so the caller can 404.
 *
 * The stages produced:
 *  1. $lookup  — join products on lines[].product  → lines_products[]
 *  2. $match   — at least one joined product has category in descendantIds
 *  3. $project — drop the temporary lines_products field
 *
 * @param {string|null|undefined} categoryId
 * @returns {Promise<Array|null>}  pipeline stages, or null on 404
 */
async function buildCategoryStages(categoryId) {
  if (!categoryId) return [];

  const categoryIds = await getDescendantIds(categoryId);
  if (!categoryIds) return null;  // category not found → caller should 404

  const oids = categoryIds.map((id) => new mongoose.Types.ObjectId(id.toString()));

  return [
    // Join each unique product referenced in any line
    {
      $lookup: {
        from:         'products',
        localField:   'lines.product',
        foreignField: '_id',
        as:           '_lineProducts',
      },
    },
    // Keep only documents where at least one line's product is in the category tree
    {
      $match: {
        '_lineProducts.category': { $in: oids },
      },
    },
    // Drop the temporary join field — keep the document shape clean
    {
      $project: { _lineProducts: 0 },
    },
  ];
}

module.exports = { buildCategoryStages };
