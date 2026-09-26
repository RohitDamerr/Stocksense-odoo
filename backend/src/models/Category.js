'use strict';

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    // Self-reference: null means this is a top-level category
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index for fast child-lookup queries (e.g. "get all sub-categories of X")
categorySchema.index({ parentCategory: 1 });

module.exports = mongoose.model('Category', categorySchema);
