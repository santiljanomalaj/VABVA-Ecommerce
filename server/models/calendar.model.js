const mongoose = require('mongoose');
const moment = require('moment');

const ObjectID = mongoose.Types.ObjectId;

const { toJSON, paginate } = require('./plugins');

const calendarSchema = mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    month: { type: String, required: true }, // "2021-09"
    quantityPerDayObj: { type: Object, default: {} }, // { '2021-09-09': 30  }
  },
  {
    timestamps: true,
    minimize: false,
  }
);

// add plugin that converts mongoose to json
calendarSchema.plugin(toJSON);
calendarSchema.plugin(paginate);
calendarSchema.statics.getHireProductsPerMonths = async function (hireProducts, session = null) {
  const allMonths = [];
  const allProductsIds = [];
  hireProducts.forEach((product) => {
    const { productId } = product;
    allProductsIds.push(ObjectID(productId));
    product.service.dates.forEach((date) => {
      const monthString = moment(new Date(date)).format('YYYY-MM').toString();
      allMonths.push(monthString);
    });
  });

  const producstPerMonths = await this.find({
    productId: { $in: allProductsIds },
    month: { $in: allMonths },
  })
    .session(session)
    .lean();
  const productPerMonthsObj = {};
  producstPerMonths.forEach((productPerMonth) => {
    const { productId, month } = productPerMonth;
    productPerMonthsObj[`${productId.toString()}@${month}`] = productPerMonth;
  });

  return productPerMonthsObj;
};
/**
 * @typedef Calendar
 */
const Calendar = mongoose.model('Calendar', calendarSchema);

module.exports = Calendar;
