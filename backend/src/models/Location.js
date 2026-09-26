'use strict';

const mongoose = require('mongoose');

const LOCATION_TYPES = ['storage', 'receiving', 'shipping', 'production', 'staging'];

const locationSchema = new mongoose.Schema(
  {
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Warehouse is required'],
    },
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: LOCATION_TYPES,
      required: [true, 'Location type is required'],
    },
    // Optional: sub-bin / shelf within this location
    parentLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

locationSchema.index({ warehouse: 1 });
locationSchema.index({ warehouse: 1, type: 1 });

module.exports = mongoose.model('Location', locationSchema);
