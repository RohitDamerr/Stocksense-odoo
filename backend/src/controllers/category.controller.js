'use strict';

const categoryService        = require('../services/category.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');

async function create(req, res) {
  try {
    const category = await categoryService.createCategory(req.body);
    return sendSuccess(res, 201, 'Category created', { category });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function list(req, res) {
  try {
    const tree = await categoryService.listCategories();
    return sendSuccess(res, 200, 'Categories retrieved', { categories: tree });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function update(req, res) {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    return sendSuccess(res, 200, 'Category updated', { category });
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

async function remove(req, res) {
  try {
    await categoryService.deleteCategory(req.params.id);
    return sendSuccess(res, 200, 'Category deleted');
  } catch (err) {
    return sendError(res, err.status || 500, err.message, err.code || 'SERVER_ERROR');
  }
}

module.exports = { create, list, update, remove };
