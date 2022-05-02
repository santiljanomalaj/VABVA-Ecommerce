const mongoose = require('mongoose');

const ObjectID = mongoose.Types.ObjectId;

const { toJSON, paginate } = require('./plugins');
const { services, costTypes } = require('../config/services');

const imagesSchema = mongoose.Schema({
  image: {
    type: String,
  },
});
const descriptionSchema = mongoose.Schema({
  text: {
    type: String,
    trim: true,
  },
  facts: [
    {
      type: String,
      trim: true,
    },
  ],
  images: [imagesSchema],
});

const costSchema = mongoose.Schema({
  type: {
    type: String,
    enum: costTypes,
  },
  amount: {
    type: Number,
  },
  minimum: {
    days: {
      type: Number,
    },
    hours: {
      type: Number,
    },
  },
  discount: {
    type: {
      type: String,
      enum: costTypes,
    },
    amount: {
      type: Number,
    },
  },
  additional: [
    {
      name: {
        type: String,
        trim: true,
      },
      description: {
        type: String,
        trim: true,
      },
      type: {
        type: String,
        enum: costTypes,
      },
      amount: {
        type: Number,
      },
      mandatory: {
        type: Boolean,
      },
    },
  ],
  sample: {
    type: Number,
  },
});

const variationSchema = mongoose.Schema({
  name: {
    type: String,
    trim: true,
  },
  items: [
    {
      colour: {
        type: String,
      },
      quantity: {
        type: Number,
        defualt: 0,
      },
      cost: {
        type: Number,
      },
      images: {
        type: [imagesSchema],
      },
    },
  ],
});

const questionSchema = mongoose.Schema({
  question: {
    type: String,
    trim: true,
  },
  answer: {
    type: String,
    trim: true,
  },
  statistics: {
    likes: {
      total: {
        type: Number,
        defualt: 0,
      },
      userId: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
    },
  },
});

const geometrySchema = mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['Polygon'],
    default: 'Polygon',
  },
  coordinates: {
    type: [[[Number]]],
    required: true,
  },
});

// add product reference
const productSchema = mongoose.Schema(
  {
    productName: {
      type: String,
      trim: true,
      default: 'Untitled',
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    service: {
      type: String,
      enum: services,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
    },
    delivery: {
      estimateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryEstimate',
      },
    },
    description: {
      type: descriptionSchema,
    },
    cost: {
      type: costSchema,
    },
    variation: [variationSchema],
    stock: {
      quantity: {
        type: Number,
        defualt: 0,
      },
    },
    questions: [questionSchema],
    summary: {
      price: {
        type: Number,
        default: 0,
      },
      priceAdditions: {
        type: Number,
        defualt: 0,
      },
      purchaseCount: {
        type: Number,
        defualt: 0,
      },
      totalReviewRating: {
        type: Number,
        defualt: 0,
      },
      geometry: {
        type: geometrySchema,
        index: '2dsphere',
      },
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
productSchema.plugin(toJSON);
productSchema.plugin(paginate);

productSchema.statics.isProductExists = async function (productId) {
  const product = await this.findOne({ _id: productId });
  return !!product;
};

productSchema.statics.isQuantityAvailable = async function (productId) {
  const product = await this.findOne({ _id: productId });
  return !!product.stock.quantity;
};

productSchema.statics.isQuantityGreater = async function (productId, quantity) {
  const product = await this.findOne({ _id: productId });
  return product.stock.quantity > quantity;
};

productSchema.statics.isWithinProductLocation = async function (productId, userLocation) {
  const product = await this.findOne({ _id: productId });
  if (!product) {
    throw new Error('User location not within product geometry');
  }

  const products = await this.find({
    'summary.geometry': { $geoIntersects: { $geometry: { type: 'Point', coordinates: userLocation } } },
  });
  const prodIds = products.map((p) => p._id.toString());
  return !(prodIds.indexOf(product._id.toString()) < 0);
};

productSchema.statics.validateBasketProducts = async function (basketData) {
  const { location, products } = basketData;
  const listOfProducts = await this.find({
    _id: { $in: products.map((product) => ObjectID(product.productId)) },
    'summary.geometry': { $geoIntersects: { $geometry: { type: 'Point', coordinates: location.coordinates } } },
  }).lean();
  if (listOfProducts.length !== products.length) {
    return null;
  }
  const productsObj = {};
  listOfProducts.forEach((product) => {
    productsObj[product._id.toString()] = product;
  });
  return productsObj;
};
/**
 * @typedef Product
 */
const Product = mongoose.model('Product', productSchema);

module.exports = Product;
