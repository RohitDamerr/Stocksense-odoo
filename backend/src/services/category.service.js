'use strict';

const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product  = require('../models/Product');

// ─── Tree builder ─────────────────────────────────────────────────────────────

/**
 * Convert a flat array of category docs into a nested tree.
 * Each node: { _id, name, parentCategory, children: [...] }
 *
 * @param {Array} categories  — all category docs (flat)
 * @returns {Array}           — top-level nodes with children populated
 */
function buildTree(categories) {
  const map = {};
  categories.forEach((c) => {
    map[c._id.toString()] = { ...c.toObject(), children: [] };
  });

  const roots = [];
  categories.forEach((c) => {
    if (c.parentCategory) {
      const parentId = c.parentCategory.toString();
      if (map[parentId]) {
        map[parentId].children.push(map[c._id.toString()]);
      } else {
        // Parent not found (edge case) — promote to root
        roots.push(map[c._id.toString()]);
      }
    } else {
      roots.push(map[c._id.toString()]);
    }
  });

  return roots;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Create a category.
 * Rejects if another category with the same name already exists under the same parent.
 */
async function createCategory({ name, parentCategory }) {
  // Normalise: null means top-level
  const parent = parentCategory || null;

  const duplicate = await Category.findOne({
    name:           { $regex: `^${name}$`, $options: 'i' },
    parentCategory: parent,
  });

  if (duplicate) {
    const err = new Error(
      parent
        ? 'A category with this name already exists under the same parent'
        : 'A top-level category with this name already exists'
    );
    err.code   = 'CATEGORY_DUPLICATE';
    err.status = 409;
    throw err;
  }

  // If a parentCategory id was given, verify it actually exists
  if (parent) {
    const parentDoc = await Category.findById(parent);
    if (!parentDoc) {
      const err = new Error('Parent category not found');
      err.code   = 'PARENT_NOT_FOUND';
      err.status = 404;
      throw err;
    }
  }

  const category = await Category.create({ name, parentCategory: parent });
  return category;
}

/**
 * Return all categories as a nested tree.
 */
async function listCategories() {
  const all = await Category.find().sort({ name: 1 });
  return buildTree(all);
}

/**
 * Rename or reparent a category.
 */
async function updateCategory(id, { name, parentCategory }) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid category id');
    err.code   = 'INVALID_ID';
    err.status = 400;
    throw err;
  }

  const category = await Category.findById(id);
  if (!category) {
    const err = new Error('Category not found');
    err.code   = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Prevent a category from becoming its own parent
  if (parentCategory && parentCategory.toString() === id.toString()) {
    const err = new Error('A category cannot be its own parent');
    err.code   = 'INVALID_PARENT';
    err.status = 400;
    throw err;
  }

  const newName   = name           !== undefined ? name           : category.name;
  const newParent = parentCategory !== undefined ? (parentCategory || null) : category.parentCategory;

  // Duplicate check at the new (name, parent) pair
  const duplicate = await Category.findOne({
    _id:            { $ne: id },
    name:           { $regex: `^${newName}$`, $options: 'i' },
    parentCategory: newParent,
  });
  if (duplicate) {
    const err = new Error('A category with this name already exists at that level');
    err.code   = 'CATEGORY_DUPLICATE';
    err.status = 409;
    throw err;
  }

  category.name           = newName;
  category.parentCategory = newParent;
  await category.save();
  return category;
}

/**
 * Delete a category — soft check: reject if any product still references it.
 */
async function deleteCategory(id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error('Invalid category id');
    err.code   = 'INVALID_ID';
    err.status = 400;
    throw err;
  }

  const category = await Category.findById(id);
  if (!category) {
    const err = new Error('Category not found');
    err.code   = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  // Block deletion if products still reference this category
  const productCount = await Product.countDocuments({ category: id, isActive: true });
  if (productCount > 0) {
    const err = new Error(
      `Cannot delete: ${productCount} active product(s) still reference this category. ` +
      'Reassign or deactivate them first.'
    );
    err.code   = 'CATEGORY_IN_USE';
    err.status = 409;
    throw err;
  }

  // Also warn if child categories exist
  const childCount = await Category.countDocuments({ parentCategory: id });
  if (childCount > 0) {
    const err = new Error(
      `Cannot delete: ${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'} exist under this category. ` +
      'Delete or reparent them first.'
    );
    err.code   = 'CATEGORY_HAS_CHILDREN';
    err.status = 409;
    throw err;
  }

  await Category.deleteOne({ _id: id });
}

/**
 * Return an array of ObjectIds containing the given categoryId plus all
 * of its descendants (recursive, breadth-first).
 *
 * Used by list endpoints when ?category= is provided so that filtering a
 * parent category automatically includes all sub-categories.
 *
 * Returns null if the category does not exist (caller should 404).
 *
 * @param {string} categoryId
 * @returns {Promise<mongoose.Types.ObjectId[] | null>}
 */
async function getDescendantIds(categoryId) {
  if (!mongoose.isValidObjectId(categoryId)) return null;

  const root = await Category.findById(categoryId).lean();
  if (!root) return null;

  // Fetch all categories once — cheap at typical category counts (<1000)
  const all = await Category.find({}, '_id parentCategory').lean();

  // Build parent → children map
  const childMap = {};
  for (const cat of all) {
    if (cat.parentCategory) {
      const key = cat.parentCategory.toString();
      if (!childMap[key]) childMap[key] = [];
      childMap[key].push(cat._id);
    }
  }

  // BFS from root
  const result = [root._id];
  const queue  = [root._id.toString()];
  while (queue.length) {
    const id       = queue.shift();
    const children = childMap[id] || [];
    for (const child of children) {
      result.push(child);
      queue.push(child.toString());
    }
  }

  return result;
}

module.exports = { createCategory, listCategories, updateCategory, deleteCategory, getDescendantIds };
